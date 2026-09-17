import { type Ref } from 'react'
import { type Node } from '../lib/api'
import { type Resolve } from '../lib/ink'
import { arcPath, tileFunctions } from '../lib/sunburst'
import { RINGS_DEFAULT } from '../lib/rings'
import { SPACING_DEFAULT } from '../lib/spacing'
import { type Views, type ColorMode } from '../lib/colorMode'
import { type Spacing } from '../lib/spacing'
import { FileZoom, cellsOf, fanOf } from './FileZoom'
import { lerpSector, place, type Arc, type Sector } from '../lib/fan'
import { viewBoxOf, type Geo, type View } from '../lib/zoom'
import { type Measure } from '../lib/label'
import { StaleHatch } from './StaleHatch'
import { HubCircles } from './HubCircles'
import { CIRCLES, type CirclesLook } from '../lib/hub'
import {
  mapModel,
  NOWHERE,
  restFrame,
  unitsPerPxFor,
  useMapModel,
  viewOf,
  type Frame,
  type MapHandlers,
  type MapInput,
  type MapModel,
} from './mapModel'
import { Coring, Labels, Leaving, Wedges, bandedOf, escalationOf } from './MapRings'
import { Patches, tilingsOf } from './MapPatches'
import { Selection, marksOf } from './MapSelection'

/* The layout (`buildModel`), its constants, the box and the frame live in `mapModel.ts`; the
   layers the picture is drawn in are `MapRings`, `MapPatches` and `MapSelection`. Re-exported
   here because this is where a caller has always found the map. */
export {
  FUNC_RIM,
  FUNC_RIM_MAX_SHARE,
  LABEL_BAND,
  LABEL_GAP,
  R_INNER,
  R_OUTER,
  mapModel,
  restFrame,
  unitsPerPxFor,
  useMapModel,
  viewOf,
  type Frame,
  type MapHandlers,
  type MapInput,
  type MapModel,
} from './mapModel'
export { DIM } from './MapSelection'

const INERT: MapHandlers = { select: () => {}, drill: () => {}, hover: () => {}, fold: () => {} }

/**
 * The map's picture, drawn from what it is handed and from nothing else.
 *
 * **One markup, two callers.** `Sunburst` is the window: it measures its pane, runs the level
 * change and the chase, follows the pointer and folds, and hands the result to `MapSvg` as a
 * frame. A report draws the same element with no window at all — `mapMarkup`, through
 * `react-dom/server`, in Node or inside the webview beside the live map — from `MapArt`, which
 * is `MapSvg` at rest. The two cannot drift apart, because there is no second copy of the
 * picture for them to drift from.
 *
 * So nothing in this file reads the page: no effect, no ref standing in for state, no layout
 * measurement, no animation frame. What the window reads for it — the canvas a name is
 * measured in, the stylesheet a name's ink is picked against, the shape of the pane — arrives
 * as a prop, and is never set on a module, because the window and an export can be drawing
 * at the same moment in one webview.
 *
 * The hub's circles (`HubCircles`) move themselves from effects. A
 * static render runs none, so what it draws is their first frame, which is their rest.
 */
export interface MapSvgProps {
  m: MapModel
  frame: Frame
  viewBox: string
  /** The wedge an open file grew out of — see `FileZoom`'s `from`. */
  fileFrom: Sector | null
  /** The pane's width over its height, which decides how wide a file's fan opens. */
  paneAspect: number
  hover: Node | null
  /** Put each wedge's id and arc on its path — see `Sunburst`'s `tagNodes`. */
  tagNodes: boolean
  /** What names are measured with — see `Measure`. The canvas when absent, which is the
   *  window. */
  measure?: Measure
  /** Where a name's ink is looked up — see `Resolve`. When absent, each paint's own `ink`,
   *  which `colorFor` picked against the document. */
  ink?: Resolve
  circles: CirclesLook
  /** Where the circles look. Only their effects read these; the markup does not. */
  gaze: Array<{ x: number; y: number }> | null
  selectedGaze: { x: number; y: number } | null
  onUp?: () => void
  on?: MapHandlers
  svgRef?: Ref<SVGSVGElement>
  artRef?: Ref<SVGGElement>
}

export function MapSvg({
  m,
  frame,
  viewBox,
  fileFrom,
  paneAspect,
  hover,
  tagNodes,
  measure,
  ink,
  circles,
  gaze,
  selectedGaze,
  onUp,
  on = INERT,
  svgRef,
  artRef,
}: MapSvgProps) {
  const { root, mode, ranks, views, unitsPerPx, selected, minPatchArea } = m
  const { geo, moving, e, leaving, coring, fileLeaving } = frame
  // Read off the frame before anything is drawn, because more than one layer asks: the events a
  // replay moves onto the nearest drawn wedge, whether the ring has room reserved for a band,
  // where every file's functions are tiled, and the marks all of those end up outlining.
  const escalated = escalationOf(m, geo)
  const banded = bandedOf(m, escalated)
  const tiled = moving ? [] : tilingsOf(m, geo)
  const marks = marksOf(m, geo, tiled, hover)

  /* Absolutely positioned rather than a flex child sized in percentages. As a flex
          child the SVG's `height: 100%` has to resolve through the chart pane, and when
          it doesn't the square viewBox falls back to its intrinsic ratio and takes its
          WIDTH as its height — which at full screen made the chart taller than the pane
          and pushed the legend off the bottom. `inset-0` makes both axes definite.

          The viewBox is the measured extent of what is DRAWN, not the nominal circle the
          constants describe. A tree shallower than the ring count never reaches `R_OUTER`, and a
          ring whose outer band is sparse does not paint to its own edge — so a fixed box
          leaves a margin whose size depends on the repo, and the map sits smaller than
          the pane it was given for reasons the reader cannot see. Measured in USER units,
          which do not change when the viewBox does, so this settles in one pass rather
          than chasing itself. */
  /* `data-sunburst` is how the movie export finds the picture to record. An attribute
          rather than a ref handed up through the app: the exporter copies whatever is on
          screen at each commit, and what it must never do is hold a second idea of what the
          map is — see `movie.ts`. */
  return (
    <svg ref={svgRef} data-sunburst="" viewBox={viewBox} className="absolute inset-0 h-full w-full">
      <StaleHatch />
      {/* NOT keyed on the root any more. A key here remounted the whole group on every
          level change, which is what forced the transition to be a keyframe played over
          a picture that had already been replaced — nothing could move from an old
          position to a new one because nothing survived the change. The wedges persist
          now and `geo` moves them; see `zoom.ts`.

          Pointer events are off while it runs. Hovering a wedge that is halfway to
          somewhere else selects a thing the tooltip then describes at coordinates it no
          longer occupies, and a click landing mid-flight lands on whatever happened to
          be under the cursor. */}
      {/* The level being left, on its way out.
          Drawn first so it passes UNDER the level arriving — what you are moving toward
          should never be occluded by what you are moving away from. And OUTSIDE the
          group the viewBox is fitted to: these fly outward past the rim, so a box drawn
          round them would zoom out and back over a transition that is not about them. */}
      {moving && <Leaving m={m} leaving={leaving} e={e} />}
      {/* `data-rings` is how the colour key finds the circle it wraps around. This group
          is the FITTED composition — every transform that places the map on screen is on
          it — so its client rect is the drawn disc itself, at whatever size and offset the
          current view put it. See `useMapEdge`, which used to estimate this from the pane
          and now measures it. */}
      <g ref={artRef} data-rings style={moving ? { pointerEvents: 'none' } : undefined}>
        {/* The directory you opened, shrinking into the middle it is about to be.
            Inside the fitted group, because it IS the arriving level's own hub and the box
            should be drawn around where it lands. Painted before everything else so it
            passes under the hub disc: it does not need to fade out, it is covered by the
            thing it turned into, which is what "became the core" should look like. */}
        {moving && coring && <Coring m={m} coring={coring} e={e} />}
        {/* An open file: its own tiling, unrolled out of the wedge it came from.
            It REPLACES the rings rather than joining them, because a file's contents are
            not an enclosure of further enclosures — they are the cells that were already
            inside its wedge, and there is no second level for a ring to describe. The
            `leaving` group above still runs, so the level being left flies outward around
            this as it opens. See `FileZoom`. */}
        {/* The file being closed, rolling back into its wedge. Drawn inside the fitted
            group and before the arriving rings, so the level you are returning to comes up
            over it rather than under — the reverse of `leaving`, which flies outward past
            the rim and is drawn first for the same reason. */}
        {moving && fileLeaving && (
          <g style={{ pointerEvents: 'none' }}>
            <FileZoom
              root={fileLeaving.node}
              // Backwards. `t` always runs 0→1 for the level arriving; what is LEAVING has
              // to read that as 1→0, or the file would unroll again on its way out.
              t={1 - e}
              from={fileLeaving.from}
              unitsPerPx={unitsPerPx}
              paneAspect={paneAspect}
              selected={null}
              mode={mode}
              ranks={ranks}
              views={views}
              minPatchArea={minPatchArea}
              onSelect={() => {}}
              onDrill={() => {}}
              onHover={() => {}}
              settled={false}
              measure={measure}
              ink={ink}
            />
          </g>
        )}
        {root.kind === 'file' && (
          <FileZoom
            root={root}
            t={e}
            from={fileFrom}
            unitsPerPx={unitsPerPx}
            paneAspect={paneAspect}
            selected={selected}
            mode={mode}
            ranks={ranks}
            views={views}
            minPatchArea={minPatchArea}
            onSelect={on.select}
            onDrill={on.drill}
            onHover={on.hover}
            tagNodes={tagNodes}
            measure={measure}
            ink={ink}
          />
        )}
        {/* Arcs first, dots after, so a dot is never buried under the ring it belongs to. */}
        {root.kind !== 'file' && (
          <Wedges m={m} geo={geo} hover={hover} escalated={escalated} tagNodes={tagNodes} on={on} />
        )}

        {/* Functions tiled INSIDE their file's wedge — see `tileFunctions`. Containment
            is structural here rather than implied, which is what a separate outer ring
            could never give, and the tiling is what lets a big file actually show what is
            in it instead of rolling most of it into one patch.

            Not drawn while the rings are in flight, and this is the trade that makes the
            whole transition affordable. A repo view holds a couple of hundred structural
            arcs and several thousand patches; re-tessellating the patches every frame is
            precisely what made per-wedge motion unaffordable and is why the old
            transition had to be one keyframe over a group. Leaving them out for 260ms
            means the moving part is the part that answers "where am I", and the detail
            resolves into place as the movement ends — which is also the moment it becomes
            worth reading. */}
        {/* Mounted once, when the rings have stopped, and faded in by CSS.
            NOT rendered per frame with an interpolated opacity, which is what this was
            first: `tileFunctions` then ran across every file on every frame of the second
            half of the transition — a few thousand patches re-tiled ten times over, which
            is precisely the cost the whole design is arranged to avoid. Opacity is the one
            thing CSS can animate here for free, so it does. */}
        <g className="patches-in" key={`patches-${root.id}`}>
          <Patches
            m={m}
            tiled={tiled}
            hover={hover}
            tagNodes={tagNodes}
            measure={measure}
            ink={ink}
            on={on}
          />
        </g>

        {/* Labels last, so they sit above every wedge.
            Both kinds are here — directories inside their plate, files curled just outside
            theirs — because they compete for the same ground and the one rule that decides
            them has to see both.

            Functions are not labeled from this pass. They are laid out angularly by
            `layout` but DRAWN tiled inside their file's band, so a name placed from the
            layout angle lands nowhere near the patch it names. The fan labels them, where
            they have room to be read. */}
        <Labels m={m} geo={geo} moving={moving} banded={banded} measure={measure} />

        <Selection marks={marks} />
      </g>

      <Hub m={m} circles={circles} gaze={gaze} selectedGaze={selectedGaze} onUp={onUp} />
    </svg>
  )
}

/** The hub is the way back out: double-click it to go up a level, the mirror of
 *  double-clicking a wedge to go in. Grouped with its labels so the whole disc is
 *  the target, not just the ring under the text. The pointer only appears when
 *  there is somewhere to go, so it never promises a level that isn't there.
 *
 *  An open file has one too, and it is this one — the fan's core is the hub, in
 *  the same place, at the same size. There was briefly a `HomeMark` here that
 *  morphed the disc into a bar at the pane's edge, which the rectangular file view
 *  needed because a treemap has no middle to spare. A fan does: it opens AROUND
 *  the core, so the affordance the rest of the app uses is simply still there and
 *  the special case is gone with the rectangle that required it. */
function Hub({
  m: { root, mode, rIn, hubDiscs },
  circles,
  gaze,
  selectedGaze,
  onUp,
}: {
  m: MapModel
  circles: CirclesLook
  gaze: Array<{ x: number; y: number }> | null
  selectedGaze: { x: number; y: number } | null
  onUp?: () => void
}) {
  return (
    <g
      onDoubleClick={
        onUp
          ? (ev) => {
              ev.stopPropagation()
              onUp()
            }
          : undefined
      }
      style={onUp ? { cursor: 'zoom-out' } : undefined}
    >
      <circle r={rIn - 4} fill="var(--card)" stroke="var(--border)" />
      <HubCircles
        r={rIn - 4}
        mode={mode}
        gaze={gaze}
        look={circles}
        palette={hubDiscs}
        path={root.path}
        selected={selectedGaze}
        depth={root.path === '' ? 0 : root.path.split('/').length}
      />
      {/* The trailing run of spaces is in the markup and always has been; a report's copy of the
          map carries it, so it stays until somebody means to change what that copy says. */}
      {onUp && <title>Double-click to go up a level</title>}{'        '}
    </g>
  )
}

/** Nothing folded, as one object, so a picture with no folds is not a new layout every time. */
const NONE: ReadonlySet<string> = new Set()

/**
 * Everything a picture of the map at rest is drawn from, stated.
 *
 * **`root` has to be complete for what it will draw.** A file the layout has room to tile needs
 * its functions in `children`: nothing here goes and gets them, and a file without them is
 * drawn solid, which is a different picture that looks like a finished one. See
 * `Report.complete`.
 *
 * The defaults are `Sunburst`'s, so a caller that says nothing draws what the window draws
 * for a reader who has touched nothing.
 */
export interface MapArtProps {
  root: Node
  mode: ColorMode
  ranks?: Map<string, number>
  views?: Views
  rings?: number
  spacing?: Spacing
  rimShare?: number
  markers?: boolean
  /** How many pixels across the picture is laid out for — `Sunburst`'s `density`. Every
   *  threshold that culls a wedge, opens a file or sizes a rim is a pixel size converted
   *  through it (`unitsPerPxFor`). */
  px: number
  sortBy?: ReadonlyMap<string, number>
  replaying?: boolean
  tagNodes?: boolean
  collapsed?: ReadonlySet<string>
  selected?: Node | null
  hover?: Node | null
  /** Width over height of what the picture sits in, which decides how wide a file's fan
   *  opens. */
  aspect?: number
  /** The wedge an open file grew out of, which keeps the fan on its bearing. */
  fileFrom?: Sector | null
  /** Node ids out with a reader. A copy has no stylesheet for the pulse, so a report passes
   *  none. */
  reading?: Set<string>
  circles?: CirclesLook
  /** What names are measured with, in width per pixel of font size — see `Measure`. */
  measure: Measure
  /** Where colour tokens are looked up, for label ink and the hub's circles: a `Resolve`, or a
   *  table of `--name` to `#rrggbb`. What the page is printed on is the caller's to say. */
  ink: Resolve | Readonly<Record<string, string>>
}

const lookupOf = (ink: MapArtProps['ink']): Resolve => {
  if (typeof ink === 'function') return ink
  const table = ink
  return (name) => table[name] ?? null
}

function inputOf(p: MapArtProps, ink: Resolve): MapInput {
  return {
    root: p.root,
    mode: p.mode,
    ranks: p.ranks,
    views: p.views,
    rings: p.rings ?? RINGS_DEFAULT,
    rimShare: p.rimShare ?? 0,
    spacing: p.spacing ?? SPACING_DEFAULT,
    markers: p.markers ?? true,
    unitsPerPx: unitsPerPxFor(p.px),
    sortBy: p.sortBy,
    replaying: p.replaying ?? false,
    collapsed: p.collapsed ?? NONE,
    selected: p.selected ?? null,
    reading: p.reading,
    ink,
  }
}

/** The box a picture at rest is fitted to. Never pinned: that is a replay's, and a replay is
 *  a window. */
const restView = (m: MapModel, p: MapArtProps): View =>
  viewOf({
    target: m.target,
    rootKind: m.root.kind,
    fileFrom: p.fileFrom ?? null,
    paneAspect: p.aspect ?? 1,
    fileIds: m.fileIds,
    morph: false,
    rIn: m.rIn,
  })

function svgPropsOf(p: MapArtProps, m: MapModel, view: View, ink: Resolve): MapSvgProps {
  return {
    m,
    frame: restFrame(m),
    viewBox: viewBoxOf(view),
    fileFrom: p.fileFrom ?? null,
    paneAspect: p.aspect ?? 1,
    hover: p.hover ?? null,
    tagNodes: p.tagNodes ?? false,
    measure: p.measure,
    ink,
    circles: p.circles ?? CIRCLES,
    gaze: null,
    selectedGaze: null,
  }
}

/** The map at rest, as a component: `MapSvg` with nothing in flight and nothing to point at. */
export function MapArt(p: MapArtProps) {
  const ink = lookupOf(p.ink)
  const m = useMapModel(inputOf(p, ink))
  return <MapSvg {...svgPropsOf(p, m, restView(m, p), ink)} />
}

/** The same picture, laid out without a component: the model, its box, and the props `MapSvg`
 *  is drawn with. `mapMarkup` renders from this rather than from `MapArt` so that what it
 *  returns beside the markup comes from the one layout the markup was drawn from. */
export function mapScene(p: MapArtProps): { m: MapModel; view: View; svg: MapSvgProps } {
  const ink = lookupOf(p.ink)
  const m = mapModel(inputOf(p, ink))
  const view = restView(m, p)
  return { m, view, svg: svgPropsOf(p, m, view, ink) }
}

/** Where one tagged wedge is: the path drawn for it, and its arc in radians and user units —
 *  exactly the `d` and `data-arc` `MapSvg` put on it. */
export interface Spot {
  d: string
  a0: number
  a1: number
  r0: number
  r1: number
}

/**
 * Every wedge a tagged picture at rest carries `data-node` on, by the same id.
 *
 * **Walked the way `MapSvg` walks it, not read back off the markup.** The ring's directories
 * and files at their layout geometry, or a file root's cells on its fan; then the function
 * patches tiled inside every file with room for them. Nothing in flight: a frame that is
 * moving tags what is on its way somewhere else, and a report never draws one.
 */
export function spotsOf(m: MapModel, fileFrom: Sector | null, paneAspect: number): Map<string, Spot> {
  const out = new Map<string, Spot>()
  const put = (id: string, g: Arc) =>
    out.set(id, { d: arcPath(g.a0, g.a1, g.r0, g.r1), a0: g.a0, a1: g.a1, r0: g.r0, r1: g.r1 })
  const at = (id: string): Geo => m.target.get(id) ?? { ...NOWHERE }
  if (m.root.kind === 'file') {
    const dest = fanOf(fileFrom, paneAspect)
    // `FileZoom`'s own arithmetic at `t = 1`, rounding included: a lerp that lands is not
    // always bit-for-bit its destination, and the path it draws is the lerp's.
    const live = fileFrom ? lerpSector(fileFrom, dest, 1) : dest
    for (const c of cellsOf(m.root, dest, m.minPatchArea)) put(c.node.id, place(c, dest, live))
  } else {
    for (const w of m.wedges) if (w.node.kind !== 'func') put(w.node.id, at(w.node.id))
  }
  for (const w of m.fileWedges) {
    const tile = m.tilingOf(at(w.node.id))
    if (!tile) continue
    const { r0, r1, fa0, fa1 } = tile
    for (const slot of tileFunctions(w.node.children, r0, r1, fa0, fa1, {
      minPatchArea: m.minPatchArea,
    }))
      put(slot.node.id, slot)
  }
  return out
}
