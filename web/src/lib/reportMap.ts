import type { Node } from './api'
import type { ColorMode, Views } from './colorMode'
import { sectorOf } from './fan'
import { mapMarkup } from './mapMarkup'
import type { MapRender, MapRequest } from './report'
import { CIRCLES, type CirclesLook } from './hub'
import { RINGS_DEFAULT } from './rings'
import { BAND_SHARE, SPACING_DEFAULT, type Spacing } from './spacing'
import { hexOf, type Vars } from './vector/color'
import type { FontSet } from './vector/surface'

/**
 * A report's figures: the map component's own markup, for a lens and a root, over the complete
 * tree — the one way a figure is made, whether a window asks or a script does.
 *
 * **Measured in the face that prints, not the one the window loaded.** Names are fitted by the
 * same HarfBuzz faces the PDF embeds, at the window's own ×1.06, so a label that fits on the page
 * is a label whose width was measured in the type it is set in.
 */

/** How the map is drawn, which a person can change in the window and a script cannot. */
export interface ReportLook {
  rings: number
  spacing: Spacing
  rimShare: number
  markers: boolean
  /** How the circles in the middle of the map are drawn. */
  circles: CirclesLook
}

/** The window's own defaults, for a report made without one. */
export const REPORT_LOOK: ReportLook = {
  rings: RINGS_DEFAULT,
  spacing: SPACING_DEFAULT,
  rimShare: BAND_SHARE,
  markers: false,
  circles: CIRCLES,
}

/** The measurer's inflation over the advance, as `widthPerPx` has it: an advance is not ink. */
const MEASURE_SLACK = 1.06

export function reportMap(o: {
  tree: Node
  views: Views
  slotsFor: (mode: ColorMode, at: Node) => Map<string, number>
  look: ReportLook
  sortBy?: ReadonlyMap<string, number>
  fonts: FontSet
  /** The stylesheet's variables with the page's ground — see `onPaper`. */
  vars: Vars
}): (req: MapRequest) => MapRender {
  const byPath = new Map<string, Node>()
  const index = (n: Node) => {
    if (n.kind !== 'func') byPath.set(n.path, n)
    n.children.forEach(index)
  }
  index(o.tree)
  const hex = hexOf(o.vars)
  const measure = (text: string, weight: number) => (weight >= 600 ? o.fonts.sansBold : o.fonts.sans).measure(text, 1) * MEASURE_SLACK

  return (req) => {
    const root = req.root === '' ? o.tree : byPath.get(req.root)
    if (!root) throw new Error(`There is no ${req.root} in this repository to draw a figure of.`)
    const base = {
      mode: req.mode,
      px: req.px,
      // Ranked over the whole repository, so a zoomed group's colors are the ones on its lens page.
      ranks: o.slotsFor(req.mode, o.tree),
      views: o.views,
      ...o.look,
      sortBy: o.sortBy,
      tagNodes: true,
      measure,
      ink: hex,
    }
    // **A file opens on the bearing its wedge had in its directory**, as it does in the window,
    // where that is the previous render's; here it is the directory's own layout, asked for once.
    let fileFrom = null
    if (root.kind === 'file') {
      const cut = root.path.lastIndexOf('/')
      const parent = byPath.get(cut < 0 ? '' : root.path.slice(0, cut)) ?? o.tree
      const spot = mapMarkup({ ...base, root: parent }).spots.get(root.id)
      if (spot) fileFrom = sectorOf(spot.a0, spot.a1, spot.r0, spot.r1)
    }
    const drawn = mapMarkup({ ...base, root, fileFrom, aspect: 1 })
    return { markup: drawn.markup, viewBox: drawn.viewBox, spots: drawn.spots }
  }
}
