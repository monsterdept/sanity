import { useMemo } from 'react'
import { type Node } from '../lib/api'
import { colorFor, type ColorMode } from '../lib/colorMode'
import { tileFunctions, vOf, type Slot } from '../lib/sunburst'
import { at, cellPath, homeSide, withBar, type Pane, type Sector } from '../lib/unroll'

/**
 * One file, unrolled out of its own wedge.
 *
 * This replaces a vertical stack of rows that shared no geometry with the rings it was
 * reached from — so drilling into a file was a hard cut to a different picture, and the
 * answer to "where am I" came from the breadcrumb rather than from the movement.
 *
 * What is drawn here is not a new view of the file. It is the SAME tiling `tileFunctions`
 * already puts inside the file's wedge, projected differently: `unroll.ts` maps the
 * wedge's `(θ, v)` rectangle onto the pane, and every patch keeps its cell for the whole
 * transition. Nothing is re-tessellated to move and nothing is matched by id, because
 * nothing has to be — there is only ever one tiling.
 *
 * The cells come from re-running `tileFunctions` in the wedge's LAST ON-SCREEN geometry
 * rather than from anything stored. That is not a shortcut, it is the only way to be sure
 * frame zero lands exactly on the picture the ring was already drawing: the tiling is
 * deterministic, so tiling the same functions into the same sector reproduces the patches
 * that were there. Storing them would be a second copy to keep in step.
 *
 * What it gives up against the stack is that position is no longer line number — a treemap
 * cannot say "nothing here", so two hundred lines of imports close up. Order survives,
 * because `tileFunctions` keeps file order. See `spanWeights` in `unroll.ts` for the one
 * cheap way to buy the proportion back, and why it is not on by default.
 */

/** The pane an unrolled file fills, in the ring's own user units.
 *
 *  Sized off the ring rather than off pixels so it composes with the viewBox interpolation
 *  the zoom already does: a file that unrolled into a box measured in pixels would be
 *  fitted by a mapping that snaps on the frame the movement ends, which is precisely the
 *  compound jump `zoom.ts` was written to remove. */
export const FILE_HALF = 340

export function fileP(boxW: number, boxH: number): Pane {
  const aspect = boxH > 0 ? boxW / boxH : 1
  const h = FILE_HALF * 2
  const w = h * aspect
  return { x: -w / 2, y: -h / 2, w, h }
}

/** How far a cell may be stretched by the unrolling before the tiling is worth redoing.
 *
 *  A wedge is squarified against the shape of the WEDGE — `worstRatio` measures on screen,
 *  inside the sector the patches will occupy — so cells that came out square in a narrow
 *  band do not stay square once that band is a pane. The distortion is the ratio of the
 *  two axes' scale factors, and it is the one number that decides whether this projection
 *  is honest or whether the file view needs its own tiling with a cross-fade into it.
 *
 *  Reported rather than corrected, for now. Correcting it means two tilings of the same
 *  file, and two tilings cannot be morphed into one another without cells visibly
 *  rearranging at the end of the movement — which is a worse artefact than a cell that is
 *  twice as wide as it is tall. Measure it on a real repo before trading one for the
 *  other. */
export const STRETCH_BUDGET = 2.5

/** How thick the return bar is, in the ring's user units.
 *
 *  Deep enough for the two things the hub carried — the file's name and its size — at the
 *  sizes they were readable at in the disc. `withBar` caps it at a third of the pane, so a
 *  narrow window loses the bar's proportion rather than the file's. */
export const BAR = 58

/** The way back, and the room left for the tiling, for a file opened out of `from`.
 *
 *  One computation, read by two callers: `FileZoom` tiles into `inner`, and the ring morphs
 *  its hub into `bar`. Working it out twice is how the disc and the cells would come to
 *  disagree about where the edge is — by a few units at first, and by a whole layout the
 *  next time one of them is touched. */
export function homeOf(from: Sector, pane: Pane) {
  const side = homeSide((from.a0 + from.a1) / 2)
  return { side, ...withBar(pane, side, BAR) }
}

export function stretchOf(from: Sector, to: Pane): number {
  // Screen width of the source sector at its mid radius, against its radial height.
  const rMid = Math.sqrt(from.v0 + from.v1)
  const srcW = (from.a1 - from.a0) * rMid
  const srcH = Math.sqrt(2 * from.v1) - Math.sqrt(2 * from.v0)
  if (srcW <= 0 || srcH <= 0) return 1
  const sx = to.w / srcW
  const sy = to.h / srcH
  return Math.max(sx / sy, sy / sx)
}

export interface FileZoomProps {
  root: Node
  /** Eased progress, 0 at the wedge and 1 at the pane. */
  t: number
  /** The file's wedge as it last stood on screen. Null when the file was never a wedge —
   *  a restored session, or a project opened straight into a file — in which case there is
   *  nothing to come out of and the tiling is simply drawn where it lands. */
  from: Sector | null
  pane: Pane
  /** The selected NODE, matching what the rings take — a file's overflow aggregate is
   *  synthesised at layout time and is not in the tree, so an id could not name it. */
  selected: Node | null
  mode: ColorMode
  ranks?: Parameters<typeof colorFor>[2]
  minPatchArea?: number
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



/** The sector a file's functions were tiled into, or null if it was never on screen.
 *
 *  Kept beside the component because the insets have to match the ones the ring applies
 *  when it draws the patches — a source sector that is a few units off makes the first
 *  frame jump, which is exactly the flinch this whole approach exists to avoid. */
export function sourceSector(
  a0: number,
  a1: number,
  r0: number,
  r1: number,
): Sector {
  return { a0, a1, v0: vOf(r0), v1: vOf(r1) }
}

export function FileZoom({
  root,
  t,
  from,
  pane,
  selected,
  mode,
  ranks,
  minPatchArea,
  onSelect,
  onDrill,
  onHover,
  settled = t >= 1,
}: FileZoomProps) {
  /** The tiling, computed once per file rather than per frame.
   *
   *  Only the PROJECTION changes across the transition, which is the whole economy of
   *  this: `tileFunctions` runs once and sixty frames re-project its output. The ring
   *  refuses to draw patches while it moves because a repo holds thousands of them across
   *  every file at once; one file is tens, and here they are the subject of the movement
   *  rather than detail that can arrive at the end. */
  const cells = useMemo<Slot[]>(() => {
    if (!from) return []
    return tileFunctions(
      root.children,
      Math.sqrt(2 * from.v0),
      Math.sqrt(2 * from.v1),
      from.a0,
      from.a1,
      { minPatchArea },
    )
  }, [root, from, minPatchArea])

  const fills = useMemo(() => {
    const m = new Map<string, ReturnType<typeof colorFor>>()
    for (const c of cells) m.set(c.node.id, colorFor(c.node, mode, ranks))
    return m
  }, [cells, mode, ranks])

  if (!from || cells.length === 0) return null

  return (
    <g>
      {cells.map((c) => {
        const fill = fills.get(c.node.id)
        const isSel = selected?.id === c.node.id
        return (
          <path
            key={c.node.id}
            className="wedge"
            d={cellPath(c, t, from, pane)}
            fill={fill?.fill}
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
        )
      })}
      {/* Labels only once the movement has finished.
          The same rule the ring uses for its patches, for the same reason and one more:
          horizontal names at full size are the single thing this view has that the wedge
          did not, and a name that slides and rescales for 260ms is unreadable for exactly
          as long as it is moving. It arrives when it becomes worth reading. */}
      {settled && (
        <g className="patches-in" pointerEvents="none">
          {cells.map((c) => {
            const tl = at(c.a0, vOf(c.r1), 1, from, pane)
            const br = at(c.a1, vOf(c.r0), 1, from, pane)
            const w = br.x - tl.x
            const h = br.y - tl.y
            // Nothing that cannot hold its own name. A clipped label is noise, and the
            // panel already says what a patch is when you click it.
            const size = Math.min(13, h * 0.4)
            if (size < 7 || w < c.node.name.length * size * 0.55) return null
            return (
              <text
                key={c.node.id}
                x={tl.x + w / 2}
                y={tl.y + h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={size}
                fill="var(--foreground)"
                opacity={0.75}
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

/**
 * The way back, anywhere between the ring's hub and an open file's edge bar.
 *
 * One shape, not two that swap. The hub was a `<circle>` and the bar a `<rect>`, and
 * switching between them on the frame the root changed was a cut sitting in the middle of
 * a transition built to have none — the disc vanished from the centre and a bar appeared
 * at an edge, with nothing saying they were the same affordance.
 *
 * A circle IS a rounded rectangle: width and height both `2r`, corner radius `r`. So there
 * is nothing to morph BETWEEN — there is one rounded rect whose five numbers are
 * interpolated, and the disc and the bar are its two ends. It runs in both directions for
 * free, because the caller passes `t` and a file on its way out simply counts down.
 *
 * The label rides the rect's centre rather than being placed at either end, which is what
 * keeps the name attached to the thing that is moving instead of jumping across the pane
 * when it arrives.
 */
export function HomeMark({
  t,
  hubR,
  bar,
  name,
  lines,
  onUp,
}: {
  t: number
  hubR: number
  bar: Pane
  name: string
  lines: number
  onUp?: () => void
}) {
  const k = Math.max(0, Math.min(1, t))
  const lerp = (a: number, b: number) => a + (b - a) * k
  const x = lerp(-hubR, bar.x)
  const y = lerp(-hubR, bar.y)
  const w = lerp(hubR * 2, bar.w)
  const h = lerp(hubR * 2, bar.h)
  // From a full semicircle to the bar's own corner. Interpolated like everything else, so
  // the disc rounds off into a bar rather than squaring up at some point along the way.
  const rx = lerp(hubR, 6)
  const cx = x + w / 2
  const cy = y + h / 2
  // The hub stacks its two lines; the bar sets them side by side, because 58 units of
  // thickness will not hold two. The switch happens with the geometry rather than at a
  // threshold: the second line's offset simply travels from below the name to beside it.
  const dy = lerp(13, 0)
  const dx = lerp(0, name.length * 4.2 + 26)
  const size = lerp(Math.max(9, Math.min(15, 150 / Math.max(name.length, 5))), 15)

  return (
    <g
      onDoubleClick={onUp ? (e) => { e.stopPropagation(); onUp() } : undefined}
      style={onUp ? { cursor: 'zoom-out' } : undefined}
    >
      <rect x={x} y={y} width={w} height={h} rx={rx} fill="var(--card)" stroke="var(--border)" />
      {onUp && <title>Double-click to go up a level</title>}
      {/* The disc is solid throughout — it is what the thing you clicked is turning INTO,
          so it has to be there to be turned into. Its label is not: swapping the name on
          the first frame would announce the destination before the thing that is
          travelling has arrived. It fades up with the rest of the detail. */}
      <g className="patches-in" key={name}>
        <text
          x={cx - dx / 2}
          y={cy + lerp(-4, 0)}
          textAnchor="middle"
          dominantBaseline={k > 0.5 ? 'central' : undefined}
          fontSize={size}
          fill="var(--foreground)"
          fontWeight={600}
        >
          {name}
        </text>
        <text
          x={cx + lerp(0, dx / 2 + 4)}
          y={cy + dy}
          textAnchor="middle"
          dominantBaseline={k > 0.5 ? 'central' : undefined}
          fontSize={9.5}
          fill="var(--muted-foreground)"
        >
          {lines.toLocaleString()} lines
        </text>
      </g>
    </g>
  )
}
