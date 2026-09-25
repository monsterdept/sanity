import { type Node } from './api'
import { type Run } from './rim'
import { type Geo, type View } from './zoom'

/** A directory's rim as it was cut for drawing — what `MapArt`'s `rimRuns` returns. */
export interface RimCut {
  runs: Run[]
  total: number
  band: Geo
}

/** The rim segment under the pointer, as the tooltip describes it. */
export interface RimSlice {
  label: string
  fill: string
  lines: number
  share: number
  held: number
  named: boolean
}

/** A pointer in the pane, in pixels from its top-left corner, turned into the map's user units
 *  under `view`.
 *
 *  The box is square and fitted `xMidYMid`, so the smaller pane dimension is the scale and the
 *  box's centre is the pane's — the same mapping the badge over the hub is placed by. */
export function toUser(
  view: View,
  box: { w: number; h: number },
  pos: { x: number; y: number },
): { x: number; y: number } {
  const scale = Math.min(box.w, box.h) / view.side
  return { x: view.cx + (pos.x - box.w / 2) / scale, y: view.cy + (pos.y - box.h / 2) / scale }
}

/** Which segment of a directory's rim the pointer is over, if any.
 *
 *  **Read from the pointer rather than hit-tested by the paths, and that is a decision
 *  about the CLICK.** Giving each segment its own listeners is the obvious version and it
 *  quietly breaks the wedge underneath: a rim path that answers the mouse also swallows
 *  the click that selects the directory and the double-click that drills into it, so the
 *  four-and-a-half pixels of a directory's own reading would become the one part of it you
 *  cannot press. Every segment would then have to re-implement select, drill and fold —
 *  three behaviours in two places.
 *
 *  So the rim stays deaf and the arithmetic answers instead. The box is square and fitted
 *  `xMidYMid`, so the smaller pane dimension is the scale and the box's centre is the
 *  pane's — the same mapping the hub's badge is placed by, one function over. Angles run
 *  clockwise from twelve, matching `arcPath`.
 *
 *  It reads `rimRuns`, which is what the paths are drawn from, so the pointer and the
 *  picture cannot disagree about which value is under it. */
export function rimSliceAt(
  node: Node | null,
  target: ReadonlyMap<string, Geo>,
  rimRuns: (node: Node, g: Geo) => RimCut | null,
  view: View,
  box: { w: number; h: number },
  pos: { x: number; y: number },
): RimSlice | null {
  if (!node || node.kind !== 'dir') return null
  const g = target.get(node.id)
  if (!g || box.w <= 0 || box.h <= 0) return null
  const cut = rimRuns(node, g)
  if (!cut) return null
  const { x: ux, y: uy } = toUser(view, box, pos)
  const r = Math.hypot(ux, uy)
  if (r < cut.band.r0 || r > cut.band.r1) return null
  // `arcPath` places a point at `(r sin a, −r cos a)`, so this inverts it — and the result
  // is wrapped into the layout's own range rather than `[0, 2π)`, because the ring starts
  // at nine o'clock and a wedge can span the seam.
  let a = Math.atan2(ux, -uy)
  while (a < cut.band.a0 - Math.PI) a += 2 * Math.PI
  while (a > cut.band.a0 + Math.PI) a -= 2 * Math.PI
  const run = cut.runs.find((x) => a >= x.a0 && a <= x.a1)
  if (!run) return null
  return {
    label: run.label,
    fill: run.fill,
    lines: run.lines,
    share: run.lines / cut.total,
    // A merged run is several values wearing the biggest one's colour, and the card has to
    // say so or it reports a share as though one person held it. A categorical merge names
    // none of them and says so in its own label instead — see `rimRuns`.
    held: run.held,
    named: run.named,
  }
}
