import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { type Node } from '../lib/api'
import { type Views, type ColorMode } from '../lib/colorMode'
import { RINGS_DEFAULT } from '../lib/rings'
import { SPACING_DEFAULT, type Spacing } from '../lib/spacing'
import { type Wedge } from '../lib/sunburst'
import { type Geo } from '../lib/zoom'
import { bearingOf, gazeOf } from '../lib/gazeTargets'
import { rimSliceAt } from '../lib/rimHit'
import { WedgeTip } from './WedgeTip'
import { CIRCLES, type CirclesLook } from '../lib/hub'
import { MapSvg, unitsPerPxFor, useMapModel, type MapHandlers } from './MapArt'
import { FindingBadge, HUB_BADGE } from './FindingBadge'
import { MapCaveat, useMapCaveat } from './MapCaveat'
import { useLevelMotion } from './useLevelMotion'
import { PLACE_NOWHERE, useMapView, usePaneBox } from './useMapView'

/* The picture itself — every wedge, rim, label and the hub — is `MapSvg`, in `MapArt.tsx`, and
   so are the constants it is drawn to. What stays here is the WINDOW: the pane it measures, the
   level change and the chase it runs, the pointer, the folds, the badge over the hub and the
   corner chip. A report draws the same element with none of those, which is why they are apart.

   Each of those is its own piece now, and this component is where they meet: `usePaneBox` and
   `useMapView` (the pane and the box fitted in it), `useLevelMotion` (every motion, as a
   frame), `gazeTargets` (where the hub looks), `rimHit` (which rim segment is under the
   pointer), `FindingBadge` and `MapCaveat`. The order they are called in is the order the old
   single body ran in, and it matters: see `useLevelMotion` for what is decided during render. */
export { DIM, LABEL_BAND, LABEL_GAP } from './MapArt'

/** Ask the window for the insides of every file the map could draw one for.
 *
 *  The test is `tilingOf` — the same one the render pass takes — so a file is asked about
 *  exactly when a tiling would be drawn if its functions were here, and never when it
 *  would not. See `onWantRings` for what this replaces and why the window could not have
 *  answered it.
 *
 *  Against the SETTLED geometry rather than the frame in flight, so a level change does
 *  not ask for a directory's worth of rings on its way past. Nothing is asked for twice:
 *  a file whose functions have arrived has children, which is the condition being
 *  tested, and the window keeps its own record of what is in flight.
 *
 *  `tilingOf` closes over the band and the patch floor, both of which are in the deps.
 *  Naming the function itself would fire this on every render. */
function useWantRings(
  { fileWedges, target, band, minPatchArea, tilingOf }: {
    fileWedges: Wedge[]
    target: Map<string, Geo>
    band: number
    minPatchArea: number | undefined
    tilingOf: (g: Geo) => unknown
  },
  onWantRings: ((paths: readonly string[]) => void) | undefined,
) {
  useEffect(() => {
    if (!onWantRings) return
    const want: string[] = []
    for (const w of fileWedges) {
      const n = w.node
      if (n.funcs <= 0 || n.children.length > 0) continue
      const g = target.get(n.id)
      if (g && tilingOf(g)) want.push(n.path)
    }
    if (want.length > 0) onWantRings(want)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileWedges, target, band, minPatchArea, onWantRings])
}

function SunburstView({
  root,
  // **Bumped once when the webfont lands, and read by nothing.** Every label here is placed
  // against a measured advance, and until the face arrives those measurements are the
  // fallback's. `memo` would otherwise hold the fallback geometry on screen for as long as
  // nothing else changed — which is how `found 67` stayed painted as `ound 67`.
  faceRev: _faceRev = 0,
  selected,
  onSelect,
  onDrill,
  onClear,
  reading,
  mode,
  ranks,
  views,
  onUp,
  findings,
  morph,
  replaying = false,
  sortBy,
  onSide,
  rings = RINGS_DEFAULT,
  rimShare = 0,
  spacing = SPACING_DEFAULT,
  markers = true,
  tagNodes = false,
  circles = CIRCLES,
  onWantRings,
}: {
  root: Node
  /** See the destructuring above — a redraw signal, deliberately unused. */
  faceRev?: number
  selected: Node | null
  onSelect: (n: Node) => void
  onDrill: (n: Node) => void
  onClear: () => void
  mode: ColorMode
  ranks?: Map<string, number>
  /** How Age is calibrated and which of its two dates it paints — see `AgeView`. Comes from the whole tree, not from `root`,
   *  so drilling into a directory does not recalibrate the colors on the way in. */
  views?: Views
  /** Undefined at the top level, which is what disables the hub's go-up affordance. */
  onUp?: () => void
  /** The creature in the middle of the hub, and what it is doing.
   *
   *  **It lives here because the hub is the one part of the window that is about the whole
   *  repo.** It used to sit in a panel under the sidebar, beside a word — Sleeping, Working,
   *  Stopping — and that panel is gone: everything else in it was about ONE project and
   *  belongs on that project's row. What was left was the app's own pulse, which has no row
   *  and does not want one. The hub already names the repo and its size; the state of the
   *  thing reading it is the third fact about the same subject.
   *
   *  Absent is a legitimate value — the history replay has no run to depict — and absence
   *  draws nothing rather than a sleeping creature over a story from 2019. */
  /** What the badge in the hub says, and what a click on it opens. Absent draws nothing — a
   *  replay has no findings to report on a story from 2019.
   *
   *  **A count is honest here because the archive makes it drainable.** Before dismissals
   *  existed the only number available was the total, and ceph's four thousand is a baseline
   *  rather than a notification; what a person can work down to nothing is worth printing.
   *  See `docs/notes/findings.md`. */
  findings?: {
    count: number
    /** How many rules are running here — the second number on the badge. */
    rules?: number
    onOpen?: (view?: 'findings' | 'rules') => void
  }
  /** Ease the rings toward the shape they are given, instead of taking it.
   *
   *  On for the history replay, which is where a tree arrives that is neither a new level
   *  nor the same picture — see `MORPH_TAU_MS`. Off for the live map: a rescan or a landed
   *  reading changes wedges too, and sliding them under somebody who is reading the map is
   *  a different decision from smoothing a replay they asked to watch. */
  morph?: boolean
  /** A replay is on screen, so a function with no reading AT THIS COMMIT is drawn as unread
   *  rather than as nothing — see where the hatch is applied. Separate from `morph`, which
   *  happens to be true at the same times: one is about easing geometry and this is about
   *  what an absent reading means, and a prop that means two things is one that gets passed
   *  for the wrong reason later. */
  replaying?: boolean
  /** The pane's own measured side, for a caller that needs to know how much denser an export
   *  is than the screen — see `frameTree`'s `density`. */
  onSide?: (px: number) => void
  /** How many rings to draw. See `RINGS_DEFAULT`; the reader chooses, within
   *  `RINGS_RANGE`. */
  rings?: number
  /** How far the directory rim is grown toward filling its whole ring, 0..1. A fifth by
   *  default — see `App`, and the paragraph below for why the number is not a taste call.
   *
   *  Zero is what it has always been: `DIR_RIM_PX`, a few pixels on the edge a directory
   *  shares with its contents, which is too little now that the rim carries a distribution
   *  rather than a colour — a container's four bands drawn where nobody reads, with its flat
   *  mean filling the space behind them.
   *
   *  **One is worse, and for a reason that is about encoding rather than taste.** The rim is a
   *  stacked bar bent around a circle: what it says is carried by ARC LENGTH, each segment
   *  against the whole, and it is a proportion. This map's own primary encoding is already
   *  area — width is lines — so area is spoken for. Grow the rim to the whole band and its
   *  segments stop being lengths and become large two-dimensional regions, which the eye reads
   *  as area, which is the other encoding. The reading turns from *what share of this directory
   *  is knotty* into *how much knotty stuff is in here*, and nothing on screen says it changed.
   *
   *  A fifth keeps it unmistakably a bar — one dimension carrying the value — and unmistakably
   *  a summary of the wedge it sits on rather than a thing with a size of its own. */
  rimShare?: number
  /** The reader's three geometry tweaks — the frame around a directory's band, the cut
   *  between two neighbours, and the gutter between two levels. See `lib/spacing.ts` for why
   *  each of them is a control, and `DIR_RIM_INSET_PX`, `CUT` and `RING_GAP` below for what
   *  the defaults they scale are FOR — the sliders move those numbers, they do not replace
   *  the arguments for them. */
  spacing?: Spacing
  /** Whether a directory's rim carries the pointing marks — see `dots`.
   *
   *  Only Traps and Clones put anything there, and this is only ever offered on those two:
   *  a switch for marks that cannot exist is an inert control, which is the argument
   *  `ColorCount` is made of. Off, the rim falls through to what every other lens draws on
   *  it, so the picture underneath the dots is legible without them — which is the whole
   *  point of being able to turn them off, since a dot is opaque and a dense directory
   *  wears a dotted line across the band it is trying to show you.
   *
   *  It does not touch the marks on the things THEMSELVES: a trapped function still pulses
   *  and a clone still wears its colour. Those are the reading; these are the pointer to
   *  where the reading is. */
  markers?: boolean
  /** Put each wedge's node id and arc on its path, as `data-node` and `data-arc`.
   *
   *  **For a report, which has to point at wedges it did not draw.** The findings page marks
   *  where each finding is on a copy of this picture, and the one thing that knows where a node
   *  landed is the path that was drawn for it. Off otherwise: thousands of attribute strings
   *  per render for a question only an export asks. */
  tagNodes?: boolean
  /** The balance wheel's speed, in full swings a second — see `WHEEL_HZ`. */
  /** The circles' shadow and the dot's travel — see `CirclesLook`. */
  circles?: CirclesLook
  /** Which files the map has somewhere to draw the insides of.
   *
   *  A file's ring of functions is fetched on demand, and the window decided which by a
   *  share of the focused subtree's lines — a stand-in for "is this wedge big enough to
   *  show an inside", chosen because the window cannot see the map. On a repo the size of
   *  kibana a quarter of a per cent is ten thousand lines, so it refused nearly every file
   *  in the repo and the outer band was empty however the map was drawn.
   *
   *  So the map answers it, which is where the answer has always been: these are the files
   *  whose wedge can actually hold a tiling, by the same test that draws one. Reported
   *  rather than fetched here — the ring belongs to the window's tree, and the component
   *  that draws a picture should not also be the thing that goes and gets it. */
  onWantRings?: (paths: readonly string[]) => void
  /** Sort siblings by this rather than by their size in the frame being drawn — see
   *  `LayoutOpts.sortBy` and `headSizes`. The replay's answer to wedges trading places
   *  under the playhead. */
  sortBy?: ReadonlyMap<string, number>
  /** Node ids out with a reader right now. They pulse.
   *
   *  **This is where a run is legible.** The sidebar used to list the names of functions
   *  as they came back, which is a progress bar you have to read, in the narrowest column
   *  on screen, saying nothing about the part this app exists to draw. Here it is a glance:
   *  the wedges being read light up, and a wave reads as a sweep across the repo — you can
   *  see it working through a directory, and you can see it stall. */
  reading?: Set<string>
}) {
  /** The hovered node plus where the pointer is, in container coordinates.
   *
   *  Replaces the SVG `<title>` elements this used to lean on. Those are rendered by the
   *  OS, which means a ~1s delay before anything appears and no say over what it says —
   *  the two complaints about it were the same bug. */
  const [hoverNode, setHoverNode] = useState<Node | null>(null)
  /** Pointer position, tracked separately from WHAT is hovered. Folding the two together
   *  meant a freshly entered wedge had no position yet — the tooltip appeared at the
   *  container's corner for one frame before the next mousemove corrected it. */
  const [pos, setPos] = useState({ x: 0, y: 0 })
  /** The badge's layer, moved with the hub. A ref rather than state for the same reason the
   *  viewBox is written to the element: this is updated every frame of a level change, and
   *  a second React render per frame to carry two numbers is most of what made the motion
   *  feel heavy. */
  const hubBadge = useRef<HTMLDivElement>(null)
  const art = useRef<SVGGElement>(null)
  const pane = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  /** Where the badge goes — written by `useMapView`, called by the pane's observer too. */
  const place = useRef(PLACE_NOWHERE)
  const [box, setBox] = usePaneBox(pane, place)

  /** User units per screen pixel, quantised — see `unitsPerPxFor`. */
  const unitsPerPx = useMemo(
    () => unitsPerPxFor(Math.min(box.w, box.h)),
    [box.w, box.h],
  )
  const hover = hoverNode ? { node: hoverNode, ...pos } : null
  /** Directories folded shut by clicking them. A view concern, so it lives here rather
   *  than in the app's drill stack — and it survives drilling, so a directory you closed
   *  stays closed when you come back past it. */
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  /** Everything the picture is laid out from — see `MapArt`'s `buildModel`. The window's own
   *  memos, moved beside the markup they serve so a report lays out through the same ones. */
  const m = useMapModel({
    root,
    mode,
    ranks,
    views,
    rings,
    rimShare,
    spacing,
    markers,
    unitsPerPx,
    sortBy,
    replaying,
    collapsed,
    selected,
    reading,
  })
  const { rIn, hubK, wedges, hidden, pulsing, fileIds, hist, rim, target, rimRuns } = m

  /** Where the creature looks — see `gazeOf` — and which way the selection is from the hub. */
  const gaze = useMemo(() => gazeOf(wedges, pulsing), [wedges, pulsing])
  const selectedGaze = useMemo(
    () => bearingOf(selected, wedges, root.id),
    [selected, wedges, root.id],
  )

  /** Every motion the map runs, as this render's frame — see `useLevelMotion`. */
  const motion = useLevelMotion({ root, wedges, target, rIn, morph })
  const { moving, e } = motion
  const { under, foldedInfo } = useMapCaveat(root, wedges, collapsed)
  useWantRings(m, onWantRings)

  /** The pane's shape, which is what the fan is sized against. Guarded so a pane that has
   *  not been measured yet asks for a square rather than for a division by zero. */
  const paneAspect = box.h > 0 ? box.w / box.h : 1
  const view = useMapView({
    target,
    root,
    fileFrom: motion.fileFrom,
    paneAspect,
    fileIds,
    morph,
    rIn,
    run: motion.run,
    moving,
    e,
    box,
    findings,
    svg,
    hubBadge,
    place,
  })

  /** Which segment of a directory's rim the pointer is over — see `rimSliceAt`. Not while the
   *  ring moves: the segment under the pointer is on its way somewhere else. */
  const hoverSlice = useMemo(
    () =>
      moving ? null : rimSliceAt(hoverNode, target, rimRuns, view.viewNow.current, box, pos),
    // `rimRuns` is new every render; what it closes over is `hist`, `unitsPerPx` and `rim`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hoverNode, target, box.w, box.h, pos.x, pos.y, moving, hist, unitsPerPx, rim],
  )

  /** What the picture does when it is pointed at — the window's, handed down to `MapSvg`. */
  const handlers: MapHandlers = {
    select: onSelect,
    drill: onDrill,
    hover: setHoverNode,
    fold: (id) => {
      // Armed before the set changes, so the chase is already on for the render that carries
      // the new layout — see `folding`. A frame late and the wedges have arrived before
      // anything eases them.
      motion.armFold()
      setCollapsed((prev) => {
        const next = new Set(prev)
        if (!next.delete(id)) next.add(id)
        return next
      })
    },
  }

  return (
    // Clicking the empty space around the chart clears the selection. Without it the
    // only way to put the panel down is to select something else, so a detail view you
    // are done with has to be replaced rather than dismissed.
    <div
      ref={pane}
      className="relative h-full min-h-0 w-full overflow-hidden"
      onClick={onClear}
      // Tracked on the container rather than per wedge: one listener instead of
      // thousands, and the tooltip keeps following the pointer as it crosses between
      // wedges. Leaving the container is the only reliable "nothing is hovered" signal
      // once the per-wedge leave handlers are gone.
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        if (r.width !== box.w || r.height !== box.h) {
          setBox({ w: r.width, h: r.height })
          onSide?.(Math.min(r.width, r.height))
        }
        setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
      }}
      onMouseLeave={() => setHoverNode(null)}
    >
      <MapSvg
        m={m}
        frame={motion.frame}
        // The box as last written to the element — see the fit effect, which moves it between
        // renders. Rendering the computed view here instead would put the destination on the
        // element for the first frame of a level change and make the effect's own comparison
        // skip the frame that puts it back.
        viewBox={view.viewBox}
        fileFrom={motion.fileFrom}
        paneAspect={paneAspect}
        hover={hoverNode}
        tagNodes={tagNodes}
        circles={circles}
        gaze={gaze}
        selectedGaze={selectedGaze}
        onUp={onUp}
        on={handlers}
        svgRef={svg}
        artRef={art}
      />

      {/* The badge's layer, over the SVG rather than inside it.
          A creature used to stand here — a WebGL canvas, which is why this is a layer and not
          a `foreignObject`: a canvas scaled by an SVG transform is a bitmap stretched rather
          than a picture redrawn. The creature is gone and the layer stays, because what it
          carries is the findings count and the hub's own gesture. Positioned imperatively in
          the fit effect above, so it travels with the disc through a level change instead of
          jumping to the new middle a frame early.

          **It carries the hub's gesture rather than swallowing it.** The layer covers most of
          the disc, and the disc means "go up a level", so the double-click passes through to
          the same place the ring underneath would take it. */}
      {findings && (
        <div
          ref={hubBadge}
          className="absolute left-0 top-0 origin-center"
          style={{
            width: HUB_BADGE * hubK,
            height: HUB_BADGE * hubK,
            visibility: 'hidden',
            cursor: onUp ? 'zoom-out' : undefined,
          }}
          onDoubleClick={
            onUp
              ? (ev) => {
                  ev.stopPropagation()
                  onUp()
                }
              : undefined
          }
        >
          {/* **The count, as a badge.** A cloud and a tail of dots were both tried here and
              both lost to the plain thing: what this has to do is carry a number legibly at a
              fifth of the hub's height, over whatever colour the innermost wedges happen to
              be, and every bit of shape spent on saying "thought" came out of the part that
              had to stay readable.

              **Drawn whatever the readers are doing.** It used to be gated on a sleeping
              creature, which is not an argument anybody made, and what it did was take the
              count off the map for the whole of a reading pass. Kibana's is minutes long;
              sanity's is 1,700 functions. For all of that the map said nothing while the panel
              behind it said forty-nine, and silence standing in for a clean bill is the one
              thing this surface is written never to do.

              The count is honest during a run, and interestingly so: tier-2 rules are blocked
              until something has been read, so the number GROWS as the readers land — which is
              the reading pass paying off, said in the one place you are already looking. */}
          {!!findings.count && (
            <FindingBadge
              layer={2}
              box={HUB_BADGE * hubK}
              rules={findings.rules ?? 0}
              count={findings.count}
              onFound={findings.onOpen ? () => findings.onOpen?.('findings') : undefined}
              onRules={findings.onOpen ? () => findings.onOpen?.('rules') : undefined}
            />
          )}
        </div>
      )}

      {/* The tooltip. Instant, because it is ours: it appears the moment a wedge is
          entered instead of waiting out the OS delay, and it can say what is actually
          worth knowing about a wedge rather than the one string `<title>` allowed.
          Flipped back across the pointer near the right or bottom edge so it is never
          clipped by the pane. */}
      {hover && (
        <WedgeTip
          node={hover.node}
          slice={hoverSlice}
          x={hover.x}
          y={hover.y}
          box={box}
          mode={mode}
          ranks={ranks}
          views={views}
          folded={hover.node.kind === 'dir' ? collapsed.has(hover.node.id) : undefined}
          // What this handle is standing in for, so the share is one hover away from the
          // mark that suppressed it rather than only in the corner.
          share={root.loc > 0 ? hover.node.loc / root.loc : undefined}
        />
      )}

      <MapCaveat
        root={root}
        hidden={hidden}
        collapsed={collapsed}
        under={under}
        foldedInfo={foldedInfo}
        onUnfold={() => {
          motion.armFold()
          setCollapsed(new Set())
        }}
      />
    </div>
  )
}

/**
 * Memoised, and the reason is the Read button.
 *
 * This component renders every arc in the repo — seventeen thousand of them on a large one
 * — so any App-level state change that reached it re-rendered the whole map. Opening a
 * dialog is such a change, and pressing Read took about a second to show anything: the
 * cost was never the dialog, it was the map being rebuilt behind it.
 *
 * Memo only pays if the props are stable, so the call site memoises `ranks` and `age`
 * and passes callbacks through `useCallback`. An inline lambda here silently undoes all of
 * this — the component still re-renders, and nothing looks wrong until somebody times a
 * click. That is the same failure mode as the poll rebuilding the frame tree because
 * `activeProject` is a fresh object every tick.
 */
export const Sunburst = memo(SunburstView)
