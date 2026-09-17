import { countPending, type Node } from '../api'
import { bucketsFor, type Bucket, type ColorMode } from '../colorMode'
import { CANCELLED } from '../movie'
import type { FigureOf } from './figure'
import type { Sheet } from './sheet'
import type { Region } from './text'
import type { Report } from './types'
import { GUTTER, MARGIN, U } from './units'
import { lensVars, methodVars } from './vars'

/**
 * What every section is laid out against (`Frame`) and drawn through (`Press`).
 *
 * **Everything is laid out before anything is drawn**, so the two are separate: a section's layout
 * takes a `Frame` and returns where everything goes, and its drawing takes that and a `Press`,
 * which knows how many pages there are because by then every page has been counted.
 */

/** The page, its two text columns, and what the prose and the keys read off this repository. */
export interface Frame {
  o: Report
  deck: boolean
  sheet: Sheet
  /** An essay column's width, and where the second one starts. */
  colW: number
  col2: number
  /** The two text columns of a page, from `top` to the foot of the body. */
  twoCols: (top: number) => Region[]
  full: Node | null
  /** Stale and unread functions, which a key over a lens a reading paints counts. */
  pending: { stale: number; unread: number }
  /** A lens's bands over the complete tree. */
  bucketsOf: (m: ColorMode) => Bucket[]
  /** The methodology's slots — see `methodVars`. */
  vars: Record<string, string>
  /** An essay's slots — see `lensVars`. */
  essayVars: Record<string, string>
}

export function frameOf(o: Report, sheet: Sheet, findings: number): Frame {
  const full = o.tree
  const contentW = (sheet.paper.w - 2 * MARGIN) * U
  const colW = (contentW - GUTTER) / 2
  const col2 = sheet.left + colW + GUTTER
  const vars = methodVars(o, findings, full)
  return {
    o,
    deck: o.form === 'deck',
    sheet,
    colW,
    col2,
    twoCols: (top) => [
      { x: sheet.left, top, bottom: sheet.bottom },
      { x: col2, top, bottom: sheet.bottom },
    ],
    full,
    pending: full ? countPending(full) : { stale: 0, unread: 0 },
    bucketsOf: (m) => (full ? bucketsFor(full, m, o.slotsFor(m, full), o.views) : []),
    vars,
    essayVars: lensVars(o, vars.readerClause),
  }
}

/** Drawing, page by page: progress, cancellation, the figures, and the end of each page. */
export class Press {
  /** Pages finished. */
  done = 0
  /** Every page there is — set once the layout has numbered them. */
  total = 0

  constructor(
    private readonly o: Report,
    readonly sheet: Sheet,
    readonly figure: FigureOf,
  ) {}

  tick(what: string) {
    this.o.onProgress({ done: this.done, total: this.total, what })
  }

  check() {
    if (this.o.cancelled()) throw new Error(CANCELLED)
  }

  begin(index: number) {
    this.sheet.begin(index)
  }

  /** Page `index` finished: its footer, and its entry in the outline where it opens something. */
  end(index: number, title?: string) {
    this.sheet.footer(index + 1, this.total)
    if (title && this.sheet.page) this.sheet.page.title = title
    this.done += 1
  }
}
