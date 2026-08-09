import { useMemo } from 'react'
import { type Node } from '../lib/api'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { CHROME_INK } from '../lib/ink'
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
import { WedgeLabel } from './WedgeLabel'
import { fitLabel } from '../lib/label'
import { WEIGHT } from '../lib/labelStyle'

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
/** The type a function's name is set in.
 *
 *  Lighter than the structure labels. A function name is the most numerous thing on this
 *  screen and the least load-bearing — the colour is the reading, the name is how you find
 *  it again — so it is set to be legible and then to get out of the way. */
const FUNC_MAX = 15
const FUNC_BEND = 0.45

export interface FileZoomProps {
  root: Node
  /** Eased progress, 0 at the wedge and 1 at the fan. */
  t: number
  /** The file's wedge as it last stood on screen. Null when the file was never a wedge in
   *  THIS composition — a restored session, a project opened straight into a file, or
   *  History, whose rings are built from a different tree than the one the file was drilled
   *  into. Null means no journey, not no picture: the fan opens on a default bearing and is
   *  drawn where it lands. It used to mean nothing was drawn at all, which is how a file in
   *  History came to render as an empty circle. */
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
 *  number or the box would be fitted to a shape the cells were never laid out for.
 *
 *  A null source is a file with no wedge behind it and still gets a fan — `fanFor` opens it
 *  on a default bearing. This used to return null, which is what left the History file view
 *  drawing nothing but its own hub. */
export function fanOf(from: Sector | null, paneAspect: number): Sector {
  return fanFor(from, paneAspect)
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
    const g = arcOf(dest)
    return tileFunctions(root.children, g.r0, g.r1, g.a0, g.a1, { minPatchArea })
  }, [root, dest, minPatchArea])

  const fills = useMemo(() => {
    const m = new Map<string, ReturnType<typeof colorFor>>()
    for (const c of cells) m.set(c.node.id, colorFor(c.node, mode, ranks))
    return m
  }, [cells, mode, ranks])

  if (cells.length === 0) return null

  // With no source wedge there is no journey, so the fan is simply AT its destination —
  // and `settled` has to say so too, or the labels wait out a transition that is not
  // happening and the file arrives nameless. See `fanFor`'s default bearing.
  const live = from ? lerpSector(from, dest, Math.max(0, Math.min(1, t))) : dest
  const arrived = settled || !from

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
                the mouse, so the patch below keeps every gesture.

                Surprise only, and for the same reason as in `Sunburst`: staleness is a fact
                about a reading, and this is the one mode painted from readings. The two
                views draw one map and have to agree about when the texture means anything. */}
            {mode === 'surprise' && c.node.agentStale && (
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
          Turned to whichever of the wedge's own two axes holds them — see `fitLabel`. Room
          is the fan's whole advantage over the band: out here a patch is big enough for a
          real name, where in the ring it had to be shrunk onto an arc and cut short when
          that still did not fit.

          At rest only. A name that slides and rescales for 260ms is unreadable for exactly
          as long as it is moving, so it arrives at the moment it becomes worth reading. */}
      {arrived && (
        <g className="patches-in">
          {cells.map((c) => {
            const paint = fills.get(c.node.id)
            const at = fitLabel(place(c, dest, live), c.node.name, {
              weight: WEIGHT,
              max: FUNC_MAX,
              // Tight. There is no ring here for a curve to belong to — the fan is a
              // treemap that happens to be drawn in polar coordinates — so a name bending
              // through a cell is distortion rather than convention.
              maxBend: FUNC_BEND,
            })
            if (!at) return null
            return (
              <WedgeLabel
                key={c.node.id}
                id={`fl-${c.node.id}`}
                at={at}
                // The patch decides the ink — this is where the whole ramp is on screen at
                // once and a single foreground was worst, names on the hot end sunk into
                // their own cells. An unread patch is `--unanalyzed` at 0.4, near enough to
                // the ground that the chrome's own foreground is the right answer.
                fill={paint ? paint.ink : CHROME_INK}
                // A clipped name is a weaker claim than a whole one and is drawn as one, so
                // the eye lands on the complete labels first.
                opacity={at.clipped ? 0.62 : 0.88}
              />
            )
          })}
        </g>
      )}
    </g>
  )
}
