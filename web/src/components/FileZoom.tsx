import { useMemo } from 'react'
import { type Node } from '../lib/api'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { arcPath, tileFunctions, type Slot } from '../lib/sunburst'
import {
  arcOf,
  centre,
  fanFor,
  lerpSector,
  place,
  room,
  type Arc,
  type Sector,
} from '../lib/fan'
import { RollupDots, dotsId, ROLLUP_TEXTURE_PX } from './RollupDots'

/**
 * One file, opened out of its own wedge into a fan.
 *
 * The wedge already holds a treemap of the file — `tileFunctions` tiles its functions
 * across it — so opening a file is not a change of representation. It is the same cells
 * getting bigger, which is a thing motion can carry and a column of rows never could.
 *
 * This was a rectangular treemap first, unrolled out of the wedge. It read well and it was
 * the wrong shape: the app is one geometry, and that was the argument that removed
 * `FileStack`. A rectangle was a second geometry arriving by a different door. See `fan.ts`
 * for what staying polar buys — briefly, the transition stops being a morph and becomes
 * the arc interpolation every wedge already does, and the tiling can be squarified against
 * the shape it will be READ in rather than the sliver it came from.
 *
 * The cells are laid out against the FAN and carried back to the wedge by `place`. Both
 * boxes are rectangles in `(θ, v)`, so that map is affine and every frame between them is
 * a valid tiling — nothing is re-tessellated to move, nothing is matched by id, and no
 * frame has a function in two places.
 */
export interface FileZoomProps {
  root: Node
  /** Eased progress, 0 at the wedge and 1 at the fan. */
  t: number
  /** The file's wedge as it last stood on screen. Null when the file was never a wedge —
   *  a restored session, or a project opened straight into a file — in which case there is
   *  nothing to grow out of and nothing is drawn. */
  from: Sector | null
  selected: Node | null
  mode: ColorMode
  ranks?: Parameters<typeof colorFor>[2]
  minPatchArea?: number
  /** User units to a screen pixel, for the roll-up texture's legibility floor. */
  unitsPerPx?: number | null
  /** The pane's width over its height, which decides how wide the fan opens. */
  paneAspect: number
  onSelect: (n: Node) => void
  onDrill: (n: Node) => void
  onHover: (n: Node | null) => void
  /** Whether this is the file at rest rather than one in flight.
   *
   *  Not inferred from `t`. A file on its way OUT starts at `t = 1` and counts down, so a
   *  `t >= 1` test showed one frame of labels before they disappeared — a flicker on every
   *  close. The caller knows which of the two it is rendering; nothing else does. */
  settled?: boolean
}

/** The fan a wedge opens into. Exported so the caller can fit its viewBox to where the
 *  composition is GOING, which is what keeps the box and the cells arriving together.
 *
 *  `paneAspect` is width over height. The span is chosen against it — a fan that fills a
 *  wide window is not the fan that fills a tall one — so both callers have to pass the same
 *  number or the box would be fitted to a shape the cells were never laid out for. */
export function fanOf(from: Sector | null, paneAspect: number): Sector | null {
  return from ? fanFor(from, paneAspect) : null
}

export function FileZoom({
  root,
  t,
  from,
  selected,
  mode,
  ranks,
  minPatchArea,
  unitsPerPx,
  paneAspect,
  onSelect,
  onDrill,
  onHover,
  settled = t >= 1,
}: FileZoomProps) {
  const dest = useMemo(() => fanOf(from, paneAspect), [from, paneAspect])

  /** The tiling, laid out once against the fan.
   *
   *  Against the FAN and not the wedge, which the affine map makes safe and which is the
   *  whole gain over the rectangle: squarified for the shape a reader looks at. Only the
   *  box it is carried into changes across the transition, so sixty frames re-place its
   *  output rather than re-tiling.
   *
   *  The ring refuses to draw patches while it moves, because a repo holds several thousand
   *  across every file at once. Priced against one file that argument does not reach, and
   *  here the patches ARE the movement rather than detail that can arrive at the end. */
  const cells = useMemo<Slot[]>(() => {
    if (!dest) return []
    const g = arcOf(dest)
    return tileFunctions(root.children, g.r0, g.r1, g.a0, g.a1, { minPatchArea })
  }, [root, dest, minPatchArea])

  const fills = useMemo(() => {
    const m = new Map<string, ReturnType<typeof colorFor>>()
    for (const c of cells) m.set(c.node.id, colorFor(c.node, mode, ranks))
    return m
  }, [cells, mode, ranks])

  if (!from || !dest || cells.length === 0) return null

  const live = lerpSector(from, dest, Math.max(0, Math.min(1, t)))

  return (
    <g>
      {cells.map((c) => {
        const fill = fills.get(c.node.id)
        const isSel = selected?.id === c.node.id
        const g: Arc = place(c, dest, live)
        // One path string, shared by the fill and every mark laid over it. Recomputing it
        // per overlay would be three placements of the same cell that could disagree by a
        // rounding, and a hatch a hair off its own patch reads as a rendering fault.
        const d = arcPath(g.a0, g.a1, g.r0, g.r1)
        const mid = centre(g)
        const size = room(g)
        return (
          <g key={c.node.id}>
            <path
              className="wedge"
              d={d}
              // Unread patches fall back to `--unanalyzed` at low opacity, exactly as they
              // do in the ring. Without the fallback an unscored function got `undefined`
              // and painted itself black — the loudest thing in the picture standing for
              // the one thing nobody has looked at.
              fill={fill ? fill.fill : 'var(--unanalyzed)'}
              fillOpacity={isSel ? 1 : fill ? 0.92 : 0.4}
              stroke={isSel ? 'var(--foreground)' : 'var(--background)'}
              strokeWidth={isSel ? 1.4 : 0.6}
              onClick={(ev) => {
                ev.stopPropagation()
                onSelect(c.node)
              }}
              onDoubleClick={(ev) => {
                ev.stopPropagation()
                onDrill(c.node)
              }}
              onMouseEnter={() => onHover(c.node)}
              onMouseLeave={() => onHover(null)}
            />
            {/* Expired. The fill underneath has already fallen back to the proxy colour —
                `applyAgentReports` drops a stale reading's score — so without the hatch the
                only sign a function was ever read is in the panel, one at a time. Deaf to
                the mouse, so the patch below keeps every gesture. */}
            {c.node.agentStale && (
              <path className="pointer-events-none" d={d} fill="url(#stale-hatch)" />
            )}
            {/* An aggregate, standing for the functions the tiling could not draw one by
                one. Its area is honest, which is exactly what makes it mistakable: it is
                the largest patch here and is drawn like a function.

                The lattice takes the patch's own bearing, with no correction — out on the
                fan a patch really is radial, so `RollupDots` does the thing it was written
                to do rather than the thing a rectangle forced on it. */}
            {c.node.rest !== undefined &&
              unitsPerPx != null &&
              Math.min(size.w, size.h) / unitsPerPx >= ROLLUP_TEXTURE_PX && (
                <>
                  <RollupDots id={dotsId(root.path)} angle={mid.a} cx={mid.x} cy={mid.y} />
                  <path
                    className="pointer-events-none"
                    d={d}
                    fill={`url(#${dotsId(root.path)})`}
                  />
                </>
              )}
          </g>
        )
      })}

      {/* Names, once the movement has finished.
          Horizontal and upright rather than bound to the arc, which is what the fan buys
          over the band: out here a patch is wide enough to hold a name across it, where in
          the ring it had to be shrunk to an arc and truncated when that still did not fit.
          A trapezoid is a worse frame for a horizontal name than a rectangle was — that is
          the price of staying one geometry — so `room` measures conservatively and anything
          that does not clear it goes without, exactly as the ring's labels do.

          At rest only. A name that slides and rescales for 260ms is unreadable for as long
          as it is moving, and this way it arrives at the moment it becomes worth reading. */}
      {settled && (
        <g className="patches-in" pointerEvents="none">
          {cells.map((c) => {
            const g = place(c, dest, live)
            const mid = centre(g)
            const size = room(g)
            const fs = Math.min(13, size.h * 0.42)
            if (fs < 7 || size.w < c.node.name.length * fs * 0.55) return null
            return (
              <text
                key={c.node.id}
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fs}
                fill="var(--foreground)"
                opacity={0.78}
              >
                {c.node.name}
              </text>
            )
          })}
        </g>
      )}
    </g>
  )
}
