/** The page of a report and a brief, in points: US Letter, and only Letter.
 *
 *  **One size, because every choice about what gives way was tuned on one sheet.** A4 was a
 *  switch here, and it is 17pt narrower and 50pt taller, so a full page, the two-page cap on a
 *  lens and a brief's trim can all land differently on it: two sizes is every layout checked
 *  twice or one of them shipped unchecked. Letter printed on A4 scales to 97%; A4 on Letter
 *  would scale to 94%. */
export const PAGE = { w: 612, h: 792 }

/** A deck's page, in points: 13.33 × 7.5 in, the 16:9 slide Keynote, PowerPoint and Slides open
 *  at. */
export const DECK_PAGE = { w: 960, h: 540 }

/** Layout units per point. The layout was tuned in the pixels of a 240 dpi canvas and every length
 *  below is written in them; a vector page keeps the unit and scales it to points once, in the
 *  `Surface`. Maps are laid out at these densities too, so what fits on a figure is unchanged. */
export const U = 240 / 72
/** Outside margin, in points. */
export const MARGIN = 42
/** A map label that would print smaller than this is left off the figure — see `drawMap`. */
export const MIN_LABEL_PT = 4.5
/** The density every figure is laid out at, in layout pixels across: a report's full-width figure,
 *  the largest any form prints. See `figureCache`. */
export const FIGURE_PX = Math.round(528 * U)
/** A numbered badge on a map: its radius, and the height of the pill it sits in. */
export const BADGE_R = 7 * U
/** Light pages are white paper — see `ReportDialog`'s ground. */
export const PAPER_WHITE = '#ffffff'
/** Between the two columns of a text page. */
export const GUTTER = 18 * U
/** Where the body starts under a page header: eyebrow, title, rule, air.
 *
 *  **No subtitle.** Each head carried a line under its title — the lens's one-line hint, a
 *  sentence about the findings — which is the switcher's tooltip set in type, and on a page that
 *  opens onto a figure and an essay it said less than either. What a figure is drawn at goes in
 *  its caption, where a figure's facts belong. */
export const HEADER_BOTTOM = (MARGIN + 8 + 25 + 10 + 14) * U
/** Where the body starts under a continuation header. */
export const CONTINUED_TOP = (MARGIN + 8 + 25 + 9 + 14) * U
/** An essay's body size. One size: the map takes the width, so an essay always runs onto the
 *  next page, and shrinking its type bought nothing but smaller type. */
export const BODY = 9
/** Between a deck slide's map and its words. */
export const DECK_GAP = 28 * U

export const lead = (size: number) => size * 1.45 * U
