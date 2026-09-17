import { FAMILY } from '../labelStyle'
import { MONO_FAMILY } from '../monoFaces'
import type { Prose } from '../reportProse'
import type { Surface } from '../vector/surface'
import { BODY, lead, U } from './units'

/**
 * Type, from a string of `reportProse` markup to rows poured into a page's columns.
 *
 * Runs are set into lines (`setLines`), blocks of lines into rows (`flow`), and rows into the
 * regions of one page after another (`pour`). Nothing here draws a page but a line and a row: the
 * page is `sheet.ts`'s.
 */

const MONO = MONO_FAMILY

export interface Run {
  text: string
  bold?: boolean
  italic?: boolean
  code?: boolean
  mono?: boolean
  muted?: boolean
  color?: string
}

interface Placed {
  text: string
  x: number
  w: number
  run: Run
  /** Air before the glyphs — the inside of a code span's left edge. */
  padL: number
}

export interface Line {
  items: Placed[]
  w: number
}

export interface Inks {
  bg: string
  fg: string
  muted: string
  border: string
  secondary: string
  accent: string
}

export function fontOf(run: Run, size: number): string {
  const face = run.code || run.mono ? MONO : FAMILY
  return `${run.italic ? 'italic ' : ''}${run.bold ? 700 : 400} ${size * U}px ${face}`
}

/* ── Lines ────────────────────────────────────────────────────────────── */

/** Punctuation that belongs to the sentence rather than to the span before it — see `wordsOf`. */
const CLINGS = /[.,;:!?)\]}'’”]/

type Piece = { text: string; run: Run; padL: number; padR: number }
/** What sits between two spaces, across runs, and the run of the space before it. */
type Word = { pieces: Piece[]; space: Run | null }

/** Runs set into lines no wider than `width` pixels.
 *
 *  Greedy, which is what a paragraph wants. **A word is what sits between spaces, across runs**:
 *  `obscure` set as code and the full stop after it are one word, so no line opens on the stop.
 *  **A code span is one piece, spaces and all**, padded at its two ends: broken across two lines it
 *  drew as two chips, and padding every word of it spaced `DO NOT EDIT` as `DO  NOT  EDIT`. Only a
 *  word wider than a whole line (a long path) is broken inside — after a `/` or `#` where one
 *  falls late enough, by character where none does. */
export function setLines(c: Surface, runs: Run[], width: number, size: number): Line[] {
  const fill = new LineFill(c, width, size)
  for (const word of wordsOf(runs, size * 0.3 * U)) fill.word(word)
  return fill.done()
}

/** Runs cut into words, a code span whole and padded by `pad` at either end. */
function wordsOf(runs: Run[], pad: number): Word[] {
  const words: Word[] = []
  let pieces: Piece[] = []
  let space: Run | null = null
  const close = () => {
    if (pieces.length) words.push({ pieces, space })
    pieces = []
    space = null
  }
  for (const run of runs) {
    if (run.code) {
      if (run.text) pieces.push({ text: run.text, run, padL: pad, padR: pad })
      continue
    }
    for (const part of run.text.split(/(\s+)/)) {
      if (!part) continue
      if (/^\s+$/.test(part)) {
        close()
        space = run
      } else pieces.push({ text: part, run, padL: 0, padR: 0 })
    }
  }
  close()

  // **A chip pads its sides, and punctuation is not a side.** The padding that keeps a code span
  // off the words around it printed `report.ts#pour` followed by a comma as `report.ts#pour ,`,
  // which reads as a space somebody left in. The pad goes where a word follows, never where a
  // mark that belongs to the sentence does.
  for (const w of words) {
    for (let i = 0; i < w.pieces.length - 1; i++) {
      const here = w.pieces[i]
      const next = w.pieces[i + 1]
      if (here.run.code && !next.run.code && CLINGS.test(next.text[0])) here.padR = 0
      if (!here.run.code && next.run.code && /[([{“‘]$/.test(here.text)) next.padL = 0
    }
  }
  return words
}

/** Lines being filled, word by word — what `setLines` carries from one word to the next. */
class LineFill {
  private readonly lines: Line[] = []
  private line: Line = { items: [], w: 0 }

  constructor(
    private readonly c: Surface,
    private readonly width: number,
    private readonly size: number,
  ) {}

  done(): Line[] {
    this.push()
    return this.lines
  }

  private widthOf(p: Piece): number {
    this.c.font = fontOf(p.run, this.size)
    return this.c.measureText(p.text).width + p.padL + p.padR
  }

  private push() {
    if (this.line.items.length) this.lines.push(this.line)
    this.line = { items: [], w: 0 }
  }

  private place(p: Piece, w: number) {
    this.line.items.push({ text: p.text, x: this.line.w, w, run: p.run, padL: p.padL })
    this.line.w += w
  }

  private placeSpace(run: Run, w: number) {
    this.place({ text: ' ', run, padL: 0, padR: 0 }, w)
  }

  /** The longest head of a code piece that ends just after a separator and fits `room`, keeping at
   *  least three characters on each side; 0 where there is none. */
  private codeCut(p: Piece, room: number): number {
    for (let k = p.text.length - 3; k >= 3; k--) {
      if (!'/.-_:#(,'.includes(p.text[k - 1])) continue
      if (this.widthOf({ ...p, text: p.text.slice(0, k), padR: 0 }) <= room) return k
    }
    return 0
  }

  word(word: Word) {
    let ws = word.pieces.map((p) => this.widthOf(p))
    let ww = ws.reduce((t, w) => t + w, 0)
    let sw = 0
    if (word.space && this.line.items.length) {
      this.c.font = fontOf(word.space, this.size)
      sw = this.c.measureText(' ').width
    }
    if (this.line.items.length && this.line.w + sw + ww > this.width) {
      if (this.breakInCode(word, sw)) {
        ws = word.pieces.map((p) => this.widthOf(p))
        ww = ws.reduce((t, w) => t + w, 0)
      }
      this.push()
      sw = 0
    }
    if (word.space && sw) this.placeSpace(word.space, sw)
    word.pieces.forEach((p, i) => this.piece(p, ws[i], ww))
  }

  /** **A code span that would leave this line well short breaks after a separator inside it**
   *  (`/ . - _ : # ( ,`), where a path or a call already divides, rather than moving whole to
   *  the next line. Two columns of prose with long unbreakable spans had edges jagged enough
   *  to read as unfinished. A span with no separator that fits, or a line already mostly
   *  full, still moves whole. True where the head was set here and the word now starts after it. */
  private breakInCode(word: Word, sw: number): boolean {
    const first = word.pieces[0]
    const cut = first.run.code && this.line.w < this.width * 0.8 ? this.codeCut(first, this.width - this.line.w - sw) : 0
    if (cut <= 0) return false
    if (word.space && sw) this.placeSpace(word.space, sw)
    const head = { ...first, text: first.text.slice(0, cut), padR: 0 }
    this.place(head, this.widthOf(head))
    word.pieces[0] = { ...first, text: first.text.slice(cut), padL: 0 }
    return true
  }

  /** One piece of a word at `pw` wide, in a word `ww` wide. Only a word no line can hold is broken
   *  inside. */
  private piece(first: Piece, pw: number, ww: number) {
    let p = first
    while (ww > this.width && this.line.w + pw > this.width && p.text.length > 1) {
      this.c.font = fontOf(p.run, this.size)
      const room = this.width - this.line.w - p.padL
      let k = p.text.length - 1
      while (k > 0 && this.c.measureText(p.text.slice(0, k)).width > room) k -= 1
      if (k === 0) {
        if (this.line.items.length) {
          this.push()
          continue
        }
        k = 1
      }
      const sep = Math.max(p.text.lastIndexOf('/', k - 1), p.text.lastIndexOf('#', k - 1))
      if (sep >= k / 3) k = sep + 1
      const head = { ...p, text: p.text.slice(0, k), padR: 0 }
      this.place(head, this.widthOf(head))
      this.push()
      p = { ...p, text: p.text.slice(k), padL: 0 }
      pw = this.widthOf(p)
    }
    this.place(p, pw)
  }
}

export function drawLine(c: Surface, line: Line, x: number, baseline: number, size: number, inks: Inks) {
  c.textBaseline = 'alphabetic'
  c.textAlign = 'left'
  for (const it of line.items) {
    if (it.run.code) {
      c.fillStyle = inks.secondary
      c.fillRect(x + it.x, baseline - size * 0.82 * U, it.w, size * 1.08 * U)
    }
    c.font = fontOf(it.run, size)
    c.fillStyle = it.run.color ?? (it.run.muted ? inks.muted : inks.fg)
    c.fillText(it.text, x + it.x + it.padL, baseline)
  }
}

/** Lines set one under another from `top`, each `lead(size)` apart. Returns where they end. */
export function drawLines(c: Surface, lines: Line[], x: number, top: number, size: number, inks: Inks): number {
  let y = top
  for (const line of lines) {
    drawLine(c, line, x, y + lead(size) * 0.74, size, inks)
    y += lead(size)
  }
  return y
}

/* ── Prose: blocks, rows, columns ─────────────────────────────────────── */

export type Block = { kind: 'p' | 'li' | 'h'; runs: Run[]; label?: string }

/** `*italic*`, `**bold**` and `` `code` `` out of a string — the whole of `reportProse`'s markup. */
export function inlineRuns(s: string, base: Omit<Run, 'text'> = {}): Run[] {
  const out: Run[] = []
  for (const part of s.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g)) {
    if (!part) continue
    if (part.length > 2 && part.startsWith('`') && part.endsWith('`')) {
      out.push({ ...base, text: part.slice(1, -1), code: true })
    } else if (part.length > 4 && part.startsWith('**') && part.endsWith('**')) {
      out.push({ ...base, text: part.slice(2, -2), bold: true })
    } else if (part.length > 2 && part.startsWith('*') && part.endsWith('*')) {
      out.push({ ...base, text: part.slice(1, -1), italic: true })
    } else out.push({ ...base, text: part })
  }
  return out
}

/** `code` spans out of a reader's note, and only those: a note is the reader's own words, and a
 *  `*` in one is an operator rather than emphasis. */
export function codeRuns(s: string, base: Run): Run[] {
  return s
    .split(/(`[^`]+`)/g)
    .filter(Boolean)
    .map((p) =>
      p.length > 2 && p.startsWith('`') && p.endsWith('`') ? { ...base, text: p.slice(1, -1), code: true } : { ...base, text: p },
    )
}

/** `{?name text}` and `{!name text}` first — the text may hold slots of its own — then `{slots}`.
 *  A gate is open when its var is a non-empty string; `lensGates` sets them. */
export function fillSlots(s: string, vars: Record<string, string>): string {
  return s
    .replace(/\{([?!])(\w+) ((?:[^{}]|\{\w+\})*)\}/g, (_, sign: string, k: string, text: string) =>
      Boolean(vars[k]) === (sign === '?') ? text : '',
    )
    .replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m)
}

export function proseBlocks(sections: Prose[], vars: Record<string, string> = {}): Block[] {
  const out: Block[] = []
  for (const sec of sections) {
    out.push({ kind: 'h', runs: [{ text: fillSlots(sec.heading, vars), bold: true }] })
    for (const raw of sec.body) {
      // A fact the repo cannot supply fills as nothing, and takes its sentence with it; a
      // paragraph that was only a fact is dropped rather than left as an empty gap.
      const filled = fillSlots(raw, vars).replace(/[ \t]{2,}/g, ' ').trim()
      if (!filled) continue
      // A slot may fill as several lines — a list of bands, one per line. Each is its own block,
      // so a list in a fact reads as a list rather than as a sentence with commas in it.
      for (const s of filled.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const bullet = /^- ([\s\S]*)$/.exec(s)
        const numbered = /^(\d+)\. ([\s\S]*)$/.exec(s)
        if (bullet) out.push({ kind: 'li', runs: inlineRuns(bullet[1]), label: '•' })
        else if (numbered) out.push({ kind: 'li', runs: inlineRuns(numbered[2]), label: `${numbered[1]}.` })
        else out.push({ kind: 'p', runs: inlineRuns(s) })
      }
    }
  }
  return out
}

/** Blocks with paragraphs taken off the end until `fits` holds, and a heading left with nothing
 *  under it taken too. Only a brief and a deck cut, and only whole paragraphs. */
export function trimToFit(blocks: Block[], fits: (b: Block[]) => boolean): Block[] {
  let b = blocks
  while (b.length > 1 && !fits(b)) {
    b = b.slice(0, -1)
    while (b.length > 1 && b[b.length - 1].kind === 'h') b = b.slice(0, -1)
  }
  return b
}

/** One set line, placed in a column. `gap` is space ABOVE it — how a paragraph break is spelled
 *  in a flow, and dropped where the line starts a column. */
export interface Row {
  line: Line
  indent: number
  lead: number
  size: number
  gap: number
  label?: string
  /** A heading: never the last line of a column. */
  keep: boolean
  /** Which block it was set from, and whether it opens that block — see `pour`, which will not
   *  split a paragraph so that one line of it stands alone. */
  block: number
  first: boolean
}

export function flow(c: Surface, blocks: Block[], width: number, size: number): Row[] {
  const rows: Row[] = []
  blocks.forEach((b, i) => {
    const s = b.kind === 'h' ? size + 0.5 : size
    const indent = b.kind === 'li' ? 12 * U : 0
    const prev = blocks[i - 1]
    const gap = !prev
      ? 0
      : b.kind === 'h'
        ? size * 1.0 * U
        : prev.kind === 'h'
          ? size * 0.2 * U
          : b.kind === 'li' && prev.kind === 'li'
            ? size * 0.25 * U
            : size * 0.55 * U
    setLines(c, b.runs, width - indent, s).forEach((line, k) => {
      rows.push({
        line,
        indent,
        lead: lead(s),
        size: s,
        gap: k === 0 ? gap : 0,
        label: k === 0 ? b.label : undefined,
        keep: b.kind === 'h',
        block: i,
        first: k === 0,
      })
    })
  })
  return rows
}

export function drawRow(c: Surface, r: Row, x: number, top: number, inks: Inks) {
  const baseline = top + r.lead * 0.74
  if (r.label) {
    c.font = fontOf({ text: r.label }, r.size)
    c.fillStyle = inks.muted
    c.textAlign = 'right'
    c.textBaseline = 'alphabetic'
    c.fillText(r.label, x + r.indent - 4 * U, baseline)
    c.textAlign = 'left'
  }
  drawLine(c, r.line, x + r.indent, baseline, r.size, inks)
}

export interface Region {
  x: number
  top: number
  bottom: number
}
export type Slice = { region: Region; rows: Row[] }

export const colHeight = (rows: Row[]) => rows.reduce((h, r, j) => h + (j ? r.gap : 0) + r.lead, 0)

/**
 * Rows poured into regions, page after page: a column, then the next, then the next page's.
 * A heading is never left at the foot of a column without its first line, and a region too
 * short for a line is skipped rather than overfilled.
 */
export function pour(rows: Row[], regionsFor: (page: number) => Region[]): Slice[][] {
  const pages: Slice[][] = []
  let i = 0
  for (let p = 0; i < rows.length && p < 500; p++) {
    const page: Slice[] = []
    const regions = regionsFor(p)
    for (const region of regions) {
      if (i >= rows.length) break
      const slice: Slice = { region, rows: [] }
      let y = region.top
      while (i < rows.length) {
        const r = rows[i]
        const h = (slice.rows.length ? r.gap : 0) + r.lead
        const next = rows[i + 1]
        const hold = r.keep && next ? next.gap + next.lead : 0
        if (y + h + hold > region.bottom) break
        slice.rows.push(r)
        y += h
        i++
      }
      // **Neither end of a paragraph stands alone.** A break that left the last line of a
      // paragraph at the top of the next column printed a page opening with the word `window.`,
      // and one that left the first line at the foot of a column is the same fault mirrored. The
      // line before the break goes forward too, so two lines travel together.
      if (i < rows.length && slice.rows.length > 1) {
        const last = slice.rows[slice.rows.length - 1]
        const next = rows[i]
        const tail = !rows[i + 1] || rows[i + 1].block !== next.block
        if (next.block === last.block && (tail || last.first)) {
          slice.rows.pop()
          i--
        }
      }
      if (slice.rows.length) page.push(slice)
    }
    // Nothing fitted anywhere on a fresh page: a row taller than any region. Placed anyway, once,
    // so the loop always advances.
    if (page.length === 0 && regions.length) {
      page.push({ region: regions[0], rows: [rows[i]] })
      i++
    }
    pages.push(page)
  }
  return pages.length ? pages : [[]]
}

/**
 * `pour`, with the last page evened up against the one before it.
 *
 * **A section's tail was a page holding four lines.** Filled page by page, the appendix ran its
 * columns full until the text ran out, so what was left over — sometimes a single paragraph —
 * got a sheet of its own. Where the last page comes out less than half full, the last two are
 * poured again into shorter columns, so the text ends on two settled pages rather than one full
 * one and a remnant. The page count never changes: a spread that would need another page keeps
 * the greedy one.
 */
export function pourEven(rows: Row[], regionsFor: (page: number) => Region[]): Slice[][] {
  const pages = pour(rows, regionsFor)
  const n = pages.length
  if (n < 2) return pages
  const fill = (pg: Slice[]) => pg.reduce((t, sl) => t + colHeight(sl.rows), 0)
  const room = regionsFor(n - 1).reduce((t, r) => t + (r.bottom - r.top), 0)
  if (room <= 0 || fill(pages[n - 1]) > room * 0.5) return pages
  const cols = Math.max(1, regionsFor(n - 2).length)
  const target = (fill(pages[n - 2]) + fill(pages[n - 1])) / (2 * cols) + lead(BODY)
  const shorter = (page: number) =>
    regionsFor(page).map((r) => (page >= n - 2 ? { ...r, bottom: Math.min(r.bottom, r.top + target) } : r))
  const out = pour(rows, shorter)
  return out.length === n ? out : pages
}

/**
 * The essay's last page, re-poured into two columns of even height.
 *
 * **Without it the tables could never use the space they were added for.** A table goes under
 * both columns, and the last page of an essay is one full column beside a few lines — so the
 * table started below the full one and the short one's half page stayed empty. Balanced, the
 * text ends halfway down and the table takes the rest.
 */
export function balance(
  slices: Slice[],
  top: number,
  xs: [number, number],
  bottom: number,
  /** Height kept free at the foot of the second column, for a table set there. The same object
   *  comes back when the page cannot be balanced around it. */
  reserve = 0,
): Slice[] {
  const rows = slices.flatMap((s) => s.rows)
  if (rows.length < 2) return slices
  // Cut at the first row that reaches half the height, so the first column is never the shorter.
  const total = colHeight(rows)
  let acc = 0
  let cut = rows.length
  for (let i = 0; i < rows.length; i++) {
    acc += (i ? rows[i].gap : 0) + rows[i].lead
    if (acc >= (total + reserve) / 2) {
      cut = i + 1
      break
    }
  }
  const a = rows.slice(0, cut)
  const b = rows.slice(cut).map((r, j) => (j === 0 ? { ...r, gap: 0 } : r))
  // A heading is never the last line of a column.
  while (a.length > 1 && a[a.length - 1].keep) b.unshift({ ...a.pop()!, gap: 0 })
  if (Math.max(colHeight(a), colHeight(b) + reserve) > bottom - top) return slices
  return [
    { region: { x: xs[0], top, bottom }, rows: a },
    { region: { x: xs[1], top, bottom }, rows: b },
  ].filter((s) => s.rows.length > 0)
}
