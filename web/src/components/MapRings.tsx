import { flashPaint, colorFor, type ColorMode } from '../lib/colorMode'
import { type Node } from '../lib/api'
import { CHROME_INK } from '../lib/ink'
import { arcPath } from '../lib/sunburst'
import { lerpGeo, type Exiting, type Geo } from '../lib/zoom'
import { WedgeLabel } from './WedgeLabel'
import { fitLabel, type Measure } from '../lib/label'
import { WEIGHT } from '../lib/labelStyle'
import { LABEL_BAND, LABEL_GAP, type MapHandlers, type MapModel } from './mapModel'

/*
 * The ring's structural layers — directories and files, never functions (`MapPatches.tsx`) — as
 * `MapSvg` draws them: the level flying out, the directory coring into the hub, the wedges with
 * their rims, and the names over all of it. Drawn from the model and the frame's `geo`, and from
 * nothing else.
 */

/** A file's name never outgrows the band it hangs off — see `LABEL_BAND`, which must stay
 *  at least `FILE_MAX × LINE` deep or nothing fits in it. */
const FILE_MAX = 11

/** How much of its own angular width a rim name gives up, per side, so two neighbors read
 *  as two names rather than one run of letters. */
const RIM_INSET = 0.06

/** How strongly each level carries the heat ramp.
 *
 *  Directories were zeroed here, on the argument that a directory's color is `hotShare` —
 *  what FRACTION of its lines are hot, a different quantity wearing the same ramp — and
 *  that because the inner rings dominate by area it would be the loudest thing on screen
 *  while the actual findings sat in thin bands at the edge.
 *
 *  Both halves of that have since stopped being true. The findings are no longer in thin
 *  bands: `tileFunctions` fills every file's wedge with per-function color, so the leaves
 *  now carry most of the painted area and a directory tint is no longer the loudest thing
 *  in the window. And the quantity is no longer raw — `shareRamp` calibrates it onto the
 *  ramp's own scale, which is what a share needed all along. Zeroing it was the right
 *  answer to a scale problem and the wrong place to fix it: measured across three repos,
 *  35 of 37 directories sat in the bottom fifth of the raw ramp, so even un-zeroed they
 *  would all have been the same gray. That is why turning this up alone would have looked
 *  like it did nothing.
 *
 *  Still not 1. Functions are the level where the number means exactly what the legend
 *  says, and the containers are a roll-up OF those numbers; drawing all three at full
 *  strength would make the ring you can read and the ring you have to interpret shout
 *  equally loudly. */
const HEAT_BY_KIND: Record<string, number> = { dir: 0.6, file: 0.55, func: 1 }

/**
 * ...but only under Surprise.
 *
 * The damping above is about ONE quantity: a directory's surprise color is its hot share,
 * a roll-up rather than a reading, and the ring carrying it is the one that dominates by
 * area. That argument does not generalise. A directory's churn, its age, its dominant
 * language and its last author are all perfectly well-defined aggregates of exactly the
 * quantity the ramp is showing — the same measurement over more code, not a different one
 * — so in those modes a damped inner ring is not restraint, it is a hole.
 */
function heatShare(kind: string, mode: ColorMode): number {
  if (mode === 'surprise') return HEAT_BY_KIND[kind] ?? 1
  return 1
}

/** The hairline between two segments of a directory's rim, in screen pixels.
 *
 *  Thinner than any of the CUTs above, because those separate THINGS and this separates
 *  values inside one thing — a gap wide enough to read as structure would turn a
 *  distribution into a row of little wedges. Wide enough that two adjacent bands of a ramp
 *  do not read as one band that changes. */
const SLICE_CUT = 0.6

/** How big a pointing dot is, in screen pixels — see `dots`.
 *
 *  Sized against the rim it sits in (`DIR_RIM_PX`), a little smaller so it reads as a mark
 *  ON the band rather than a piece of one. Under about two it disappears against the
 *  structure; much over four and a row of them closes into a rim, which is the encoding
 *  this deliberately is not. */
const DOT_PX = 3.2

type Fill = ReturnType<typeof colorFor>

/** A directory's reading on the edge it shares with its contents — see `DIR_RIM_PX`.
 *
 *  `flash` says the colour is an EVENT rather than a reading: during a replay a directory
 *  whose subtree gained or lost code in this commit has nowhere of its own to say so, so
 *  it says it here (see `escalated`). An event must win outright over a distribution and a
 *  mark, and it must do so structurally rather than because a replay happens to have the
 *  other two switched off — this rim is the only slot the flash has, and a histogram drawn
 *  over it is the commit under the playhead going unreported. */
function DirRim({
  m,
  node,
  c,
  g,
  fade = 1,
  flash = false,
}: {
  m: MapModel
  node: Node
  c: Fill
  g: Geo
  fade?: number
  flash?: boolean
}) {
  const { mode, spacing, unitsPerPx, dots, rimBand, rimRuns } = m
  if (node.kind !== 'dir') return null
  const { r0, r1, a0, a1 } = rimBand(g)
  if (r1 <= r0) return null
  const opacity = fade * heatShare('dir', mode)

  /** The distribution, when this lens has one — see `histogramsFor`. */
  const cut = flash ? null : rimRuns(node, g)
  if (cut) {
    return (
      <g className="pointer-events-none">
        {cut.runs.map((s, i) => {
          return (
            <path
              key={i}
              d={arcPath(s.a0, s.a1, r0, r1)}
              fill={s.fill}
              fillOpacity={opacity}
              // A hairline of the ground between segments, on the rule the ring's own CUTs
              // follow: two values that abut with no gap read as one value that changes,
              // which is the one thing a categorical rim must not say.
              //
              // **It goes with the frame.** The reader's switch is about ground showing on a
              // directory's band, and these hairlines are ground showing on a directory's
              // band — leaving them lit while the frame around them is off is the switch
              // doing most of what it says and then stopping. What it costs is stated
              // above, and it is the reader's to spend: two segments of one ramp that abut
              // read as one segment, so an unbroken band is a distribution you can see the
              // shape of and not one you can count.
              stroke={spacing.border ? 'var(--background)' : 'none'}
              strokeWidth={SLICE_CUT * (unitsPerPx ?? 1)}
            />
          )
        })}
      </g>
    )
  }

  /** The pointing marks — see `dots`. Drawn in the rim's own band, so a lens that marks
   *  and a lens that measures put their answer in the same place on the wedge. */
  const marks = flash ? undefined : dots?.get(node.id)
  if (marks && marks.length > 0) {
    const rMid = (r0 + r1) / 2
    const px = unitsPerPx ?? 1
    const rad = (DOT_PX * px) / 2
    // Merged by proximity, in ANGLE at this radius — the same threshold in pixels means a
    // different angle on every ring, and the eye is reading pixels.
    const gap = (DOT_PX * 1.6 * px) / Math.max(rMid, 1)
    const keep: number[] = []
    for (const a of [...marks].sort((x, y) => x - y)) {
      if (a < a0 || a > a1) continue
      if (keep.length === 0 || a - keep[keep.length - 1] >= gap) keep.push(a)
    }
    return (
      <g className="pointer-events-none">
        {keep.map((a) => (
          <circle
            key={a}
            cx={rMid * Math.sin(a)}
            cy={-rMid * Math.cos(a)}
            r={rad}
            fill={mode === 'traps' ? 'var(--trap)' : 'var(--clone)'}
            fillOpacity={fade}
          />
        ))}
      </g>
    )
  }

  if (!c) return null
  return (
    <path
      className="pointer-events-none"
      d={arcPath(a0, a1, r0, r1)}
      fill={c.fill}
      fillOpacity={opacity}
    />
  )
}

/** The flash each drawn file or directory wears for a replay event that has no wedge of
 *  its own to land on, keyed by node id. Functions are never in the map: a drawn
 *  function flashes through its own colour.
 *
 *  Each wedge asks one question of the nodes below it. A directory looks only at its
 *  children that are NOT drawn, and flashes if any of them carries an event, on itself
 *  (`score.appeared`, `score.edited`) or anywhere under it (`birthBelow`, `touchBelow`,
 *  which the fold rolls up). A file flashes only when it is drawn solid, since a file
 *  with room to tile shows the event on the function's own tile. Birth wins over a
 *  touch, as it does in `colorFor`, because the commit that creates a function also
 *  touches it.
 *
 *  Why it exists: on anything the size of home-assistant no function has a wedge, and
 *  most files do not either, so the commit under the playhead had nowhere to land. The
 *  ladder (the function if drawn, else its file, else the directory that holds it) is
 *  decided here rather than in the fold, because "is it drawn" depends on this pane's
 *  size and drill stack. Looking only at undrawn children is enough because culling
 *  takes whole subtrees (`layout`), so the drawn wedges form a connected tree and an
 *  event under an undrawn child is one no drawn descendant can be showing. That is also
 *  why this is not a roll-up: it lights exactly one wedge per event, the deepest one
 *  there is room for. */
export function escalationOf(m: MapModel, geo: (id: string) => Geo) {
  const { wedges, tilingOf } = m
  const escalated = new Map<string, ReturnType<typeof flashPaint>>()
  const drawn = new Set(wedges.map((w) => w.node.id))
  const birthUnder = (n: Node) => n.birthBelow === true || n.score?.appeared != null
  const touchUnder = (n: Node) => n.touchBelow === true || n.score?.edited != null
  for (const w of wedges) {
    const n = w.node
    if (n.kind === 'func') continue
    let birth = false
    let touch = false
    if (n.kind === 'file') {
      // A file with room to tile shows the event on the function it happened to, which
      // is the ladder's first rung working. Only a file drawn solid stands in for its
      // own contents.
      if (tilingOf(geo(n.id)) === null) {
        birth = birthUnder(n)
        touch = touchUnder(n)
      }
    } else {
      for (const c of n.children) {
        if (drawn.has(c.id)) continue
        birth = birth || birthUnder(c)
        touch = touch || touchUnder(c)
        if (birth && touch) break
      }
    }
    // Arrival beats a touch, the same way it does in `colorFor` and for the same
    // reason: the commit that creates a function also touches it.
    if (birth || touch) escalated.set(n.id, flashPaint(birth ? 'birth' : 'touch'))
  }
  return escalated
}

export type Escalated = ReturnType<typeof escalationOf>

/** Whether anything on this ring can carry a directory band — which is what decides
 *  where a directory's NAME sits. See `plateOf`.
 *
 *  **The three things `dirRim` will draw, asked in the same order it asks them**: a
 *  distribution, the pointing marks, or the wedge's own colour as a solid band. If none of
 *  them answers for any drawn directory then the strip above every name is empty, and a
 *  name centred below an empty strip is a name that looks like it slid.
 *
 *  **`fills` is asked for its VALUE, not for the key.** It holds an entry for every
 *  non-function wedge and the entry is often `null` — `colorFor` returning nothing is how a
 *  directory says it has no reading under this lens, and `dirRim` checks exactly that
 *  before drawing. Asking `has` made this true on every ring ever drawn, so the room was
 *  still being reserved everywhere and the whole check did nothing.
 *
 *  True during a replay whatever it finds, because the room must not come and go with the
 *  playhead — a rim that exists for one commit would move every label in the picture and
 *  put it back on the next.
 *
 *  Cheap: it walks the drawn wedges, which is hundreds, and stops at the first yes. The
 *  maps it reads are the ones already memoised for the ring. */
export function bandedOf({ replaying, wedges, hist, dots, fills }: MapModel, escalated: Escalated) {
  return (
    replaying ||
    wedges.some(
      (w) =>
        w.node.kind === 'dir' &&
        ((hist.get(w.node.id)?.length ?? 0) > 0 ||
          (dots?.get(w.node.id)?.length ?? 0) > 0 ||
          fills.get(w.node.id) != null ||
          escalated.get(w.node.id) != null),
    )
  )
}

/** The level being left, on its way out. */
export function Leaving({ m, leaving, e }: { m: MapModel; leaving: Exiting[]; e: number }) {
  const { mode, ranks, views, cutAt } = m
  return leaving.map((x) => {
    const g = lerpGeo(x.from, x.to, e)
    const c = colorFor(x.node, mode, ranks, views)
    const plate = x.node.kind === 'dir' ? null : c
    return (
      <g key={`leaving-${x.node.id}`}>
        <path
          d={arcPath(g.a0, g.a1, g.r0, g.r1)}
          fill={plate ? plate.fill : 'var(--structure)'}
          fillOpacity={(1 - e) * (plate ? heatShare(x.node.kind, mode) : 1)}
          stroke="var(--background)"
          strokeWidth={cutAt(x.node.kind, g.a0, g.a1, g.r0)}
        />
        <DirRim m={m} node={x.node} c={c} g={g} fade={1 - e} />
      </g>
    )
  })
}

/** The directory you opened, shrinking into the middle it is about to be. */
export function Coring({
  m,
  coring,
  e,
}: {
  m: MapModel
  coring: { node: Node; from: Geo; to: Geo }
  e: number
}) {
  const { mode, ranks, views, cutAt } = m
  const g = lerpGeo(coring.from, coring.to, e)
  const c = colorFor(coring.node, mode, ranks, views)
  return (
    <g>
      <path
        d={arcPath(g.a0, g.a1, g.r0, g.r1)}
        fill="var(--structure)"
        fillOpacity={1}
        stroke="var(--background)"
        strokeWidth={cutAt('dir', g.a0, g.a1, g.r0)}
      />
      <DirRim m={m} node={coring.node} c={c} g={g} />
    </g>
  )
}

/** Every directory and file on the ring: its plate, its hit target, its fold handle, its rim and
 *  its reading pulse. */
export function Wedges({
  m,
  geo,
  hover,
  escalated,
  tagNodes,
  on,
}: {
  m: MapModel
  geo: (id: string) => Geo
  hover: Node | null
  escalated: Escalated
  tagNodes: boolean
  on: MapHandlers
}) {
  const { mode, collapsed, selected, wedges, pulsing, band, fills, ringGap, cutAt } = m
  return wedges
    .filter((w) => w.node.kind !== 'func')
    .map((w) => {
      // Directories get the full gap and a visible rule; files sit tighter to the
      // functions they contain, so the eye groups file-with-contents rather than
      // file-with-neighboring-directory.
      // Geometry comes from `geo`, which is the settled position when nothing is
      // moving and a point on the way there when something is. One source, so the
      // moving picture and the still one cannot disagree.
      const g = geo(w.node.id)
      const { a0, a1, r0, r1 } = g
      // Directories used to be hard-nulled here, and that made `HEAT_BY_KIND.dir`
      // dead code: the damping is applied as `fillOpacity` on a color, so a wedge
      // with no color at all could never be damped, only blanked. Turning that
      // constant up did nothing, which is a bad way for a policy to be stated twice.
      //
      // It also blanked directories in EVERY mode, while `heatShare` carves out an
      // explicit exception for the other four — a directory's churn, age, owner and
      // language are the same measurement over more code, so a gray inner ring there
      // is a hole rather than restraint. That exception was unreachable.
      //
      // One mechanism now: `colorFor` decides WHAT a wedge means, `heatShare` decides
      // how loudly its level says it.
      // The wedge's own reading, or an event from below that has nowhere else to be
      // drawn — see `escalated`. Its own comes first: a directory that is flashing its
      // own arrival is already saying the loudest thing it has to say.
      const c = fills.get(w.node.id) ?? escalated.get(w.node.id) ?? null
      /** The colour came from an event rather than from a reading — see `dirRim`. */
      const flashing = !fills.has(w.node.id) && escalated.has(w.node.id)
      // A directory's reading goes on its rim, not through it — `DIR_RIM_PX`. What is
      // left here is the plate, which is structure and takes the structural neutral,
      // exactly as an unread directory always did.
      const plate = w.node.kind === 'dir' ? null : c
      // Agent verdicts and model surprisal are different instruments and must be
      // told apart at a glance. Hue is spoken for — it is the reading itself — so the
      // distinction goes on the outline.

      const isSel = selected?.id === w.node.id
      const isHover = hover?.id === w.node.id
      const foldable = w.node.kind === 'dir' && w.node.children.length > 0
      const isFolded = foldable && collapsed.has(w.node.id)
      const isReading = pulsing?.has(w.node.id) ?? false
      return (
        <g key={w.node.id}>
          {/* An invisible target, wider than the thing it selects.
              A file's own visible area is the rim its functions do not cover — about
              three pixels, which is a coin-flip to hit and the reason selecting a file
              meant several tries. This spans the whole band plus half the gutter on
              either side, drawn UNDER the functions so they still take their own
              clicks. Nothing about the picture changes; only the part of it that
              answers the mouse. */}
          {w.node.kind === 'file' && (
            <path
              d={arcPath(a0, a1, r0 - ringGap * 0.5, r0 + band)}
              fill="transparent"
              onMouseEnter={() => on.hover(w.node)}
              onMouseLeave={() => on.hover((n) => (n?.id === w.node.id ? null : n))}
              onClick={(e) => {
                e.stopPropagation()
                on.select(w.node)
              }}
              onDoubleClick={(e) => {
                e.stopPropagation()
                on.drill(w.node)
              }}
            />
          )}
          <path
            className="wedge"
            data-node={tagNodes ? w.node.id : undefined}
            data-arc={tagNodes ? `${a0} ${a1} ${r0} ${r1}` : undefined}
            // A file occupies exactly ONE band, like a directory. Its functions are
            // inset inside that band, so the file's own fill shows as a rim around
            // them — the containment is drawn, not implied by adjacency.
            d={arcPath(a0, a1, r0, r1)}
            // Unanalyzed wedges take the neutral, not the ramp — see `isAnalyzed`.
            // A folded directory is drawn a shade heavier than an open one, so the
            // ring that ends at it reads as packed rather than as genuinely empty.
            fill={
              plate
                ? plate.fill
                : isFolded
                  ? 'color-mix(in oklch, var(--structure) 78%, var(--foreground))'
                  : 'var(--structure)'
            }
            fillOpacity={
              isSel || isHover
                ? 0.95
                : plate
                  ? heatShare(w.node.kind, mode)
                  : w.node.kind === 'dir'
                    ? 1
                    : 0.5
            }
            // Directories, files and functions are three different kinds of thing and
            // used to be drawn identically, which made the rings read as one
            // undifferentiated mass. Stroke carries the distinction rather than hue,
            // because hue is spoken for — it is the entire message of the chart.
            // Hover gets the same outline treatment as selection, one step quieter:
            // brightening the fill alone was ambiguous on a ring of already-bright
            // wedges, so the thing under the cursor now states its own boundary.
            //
            // Everything else is separated by a CUT, not a line: the stroke is the
            // background color, so what you see is the gap between two plates. The
            // drawn foreground outline directories used to carry was the brightest
            // thing on screen, and it sat around the level whose reading is the
            // quietest — the eye went to structure instead of to heat.
            stroke="var(--background)"
            strokeWidth={cutAt(w.node.kind, a0, a1, r0)}
            onMouseEnter={() => on.hover(w.node)}
            onMouseLeave={() => on.hover((n) => (n?.id === w.node.id ? null : n))}
            onClick={(e) => {
              e.stopPropagation()
              // Option-click folds a directory shut — the cheap way to get a subtree
              // out of the picture without leaving the level you are on. On a modifier
              // rather than a plain click so selecting still does exactly one thing,
              // and Option rather than Command because Option-click is already the
              // disclosure gesture on this platform; Command-click means "open
              // elsewhere" nearly everywhere else.
              if (e.altKey && foldable) {
                // The window folds, and arms its chase first — see `Sunburst`'s
                // `handlers`.
                on.fold(w.node.id)
                return
              }
              on.select(w.node)
            }}
            onDoubleClick={() => on.drill(w.node)}
          ></path>
          {/* **The handle is hatched, so it cannot be read as a small wedge.**
              A narrow wedge says "this is a small thing", and what somebody folds
              is usually the largest thing in the ring — so the one shape this must
              not take is the shape everything around it has. The texture is the
              statement; see `fold-hatch`. Deaf to the mouse so the wedge under it
              keeps every gesture, including the ⌥-click that puts it back. */}
          {isFolded && (
            <path d={arcPath(a0, a1, r0, r1)} fill="url(#fold-hatch)" pointerEvents="none" />
          )}
          {/* The reading itself, on the edge the directory shares with its contents. */}
          <DirRim m={m} node={w.node} c={c} g={g} fade={1} flash={flashing} />
          {/* Out with a reader: a white pulse over the wedge.
              **After the wedge, not before it.** SVG paints in document order, so the
              first version of this drew the marker and then painted the wedge's own
              opaque fill straight over it — present in the DOM, animating, and invisible
              on every frame. Its own path so the wedge's fill, opacity and stroke are
              untouched: a run must not change what the map SAYS, only show where it is
              working. `pointer-events: none` because it covers the clickable path. */}
          {isReading && (
            <path
              className="wedge-reading"
              d={arcPath(a0, a1, r0, r1)}
              fill="var(--foreground)"
              pointerEvents="none"
            />
          )}
        </g>
      )
    })
}

/** The names of the directories and files on the ring. */
export function Labels({
  m,
  geo,
  moving,
  banded,
  measure,
}: {
  m: MapModel
  geo: (id: string) => Geo
  moving: boolean
  banded: boolean
  measure?: Measure
}) {
  const { spacing, collapsed, wedges, cuts, rim } = m
  /** The part of a directory's plate its band does not speak for — where the name goes.
   *
   *  **Reserved per RING, never per wedge, and never during a replay.** The room a band
   *  takes is subtracted from the top of the plate, and a name centred in what is left sits
   *  lower than the middle of its wedge — which is correct while there is a band up there
   *  and wrong when there is not: under a lens that paints no directory rim at all, `src`,
   *  `web` and `components` all sat visibly inboard with a strip of empty plate above them.
   *
   *  Two versions of this are wrong. Asking per wedge gives one directory a centred name and
   *  its neighbour a low one on the same ring, which reads as labels that slid. Asking every
   *  frame of a replay is a rim appearing for one step of the playhead and every label in the
   *  picture twitching inward and back on the commit after — the original argument for
   *  reserving unconditionally, and it still holds, so a replay keeps the room reserved
   *  whatever it is painting.
   *
   *  What is left is a property of the lens over the ring on screen: either something up
   *  there can carry a band, or nothing can. See `banded`.
   *
   *  The inset counts twice: once as the band's own margin from the edge, once again as
   *  the gap between the band and the text, so a name is not set against the thing above
   *  it. That is what had `tui` riding high in its wedge with its own ring through the
   *  ascenders. */
  const plateOf = (g: Geo): Geo =>
    banded
      ? {
          ...g,
          // The band's own trim from the wedge edge (`rimBand`), then the band, then the
          // clear air above the name. With the frame on the first two of those are the same
          // number, which is the `inset * 2` this used to read as.
          r1: Math.max(
            g.r0,
            g.r1 - (spacing.border ? rim.inset : cuts.dir / 2) - rim.width - rim.gap,
          ),
        }
      : // Nothing to make room for, so the name is centred in the whole plate — less the
        // trim the plate itself is drawn inside of, which is containment rather than a band.
        { ...g, r1: Math.max(g.r0, g.r1 - (spacing.border ? rim.inset : cuts.dir / 2)) }

  return (
    (moving ? [] : wedges)
      .filter((w) => w.node.kind === 'dir' || w.node.kind === 'file')
      // **A handle carries no name.** `fitLabel` will find room for one — a
      // thirteen-pixel stub is deep enough for a radial run at the size floor — and
      // what it produces is six-unit type over a cross-hatch, which is neither
      // readable as a name nor quiet enough to read as a mark. The corner chip names
      // the fold and the hover gives it in full; the shape's whole job here is to be
      // unmistakably not a wedge.
      .filter((w) => !(w.node.kind === 'dir' && collapsed.has(w.node.id)))
      .map((w) => {
        // Fixed to where the wedge is THIS frame, like everything else. A label left at
        // its settled angle while its wedge travels is text sitting on a neighboring
        // directory for the length of the transition.
        const g = geo(w.node.id)
        const isDir = w.node.kind === 'dir'
        // A directory is a structural plate with nothing behind it, so its name sits in
        // the middle of it.
        //
        // A file is the opposite: its band is its own function tiling, and a name
        // printed over that is printed over the data it names. Files were therefore not
        // labeled at all. What they have instead is the one thing nothing else on the
        // ring has — a file is the outermost structural level, so the ground just past
        // its rim belongs to nobody. The name goes THERE, curled around the outside,
        // where it costs the tiling nothing.
        //
        // A rim name is confined to its OWN wedge's angular slice, inset on both
        // sides. Beyond the rim there is no plate to hold it, so the only thing
        // separating one file's name from the next is the wedge each belongs to —
        // without the inset, adjacent names run together into a single unreadable
        // band, which is what `command.rs browse.rs event_loop.rs app.rs` had become.
        // The inset is what makes the gap between two names visibly a gap.
        const pad = (g.a1 - g.a0) * RIM_INSET
        const cell = isDir
          ? plateOf(g)
          : {
              a0: g.a0 + pad,
              a1: g.a1 - pad,
              r0: g.r1 + LABEL_GAP,
              r1: g.r1 + LABEL_GAP + LABEL_BAND,
            }
        const at = fitLabel(cell, w.node.name, {
          weight: WEIGHT,
          // Off the cell's OWN depth, not off `band`. The two were the same thing
          // while a directory's name had the whole ring to sit in; now the band takes
          // the top of it, and sizing to the ring would set a name too big for the
          // room actually left under it.
          max: isDir ? Math.max(11, Math.min(17, (cell.r1 - cell.r0) * 0.34)) : FILE_MAX,
          // Arc only out here. The rim band is a thin annulus and whatever lies past it
          // belongs to somebody else, so a radial run leaves this file's territory on
          // its first character.
          only: isDir ? undefined : 'arc',
          measure,
        })
        if (!at) return null
        return (
          // Hidden outright while the ring moves, rather than faded per frame. A name is
          // read, not glanced at, and text re-fitting its arc every frame is unreadable
          // anyway — so it would cost a `<defs>` and a textPath per wedge per frame to
          // render something nobody can use.
          <WedgeLabel
            key={`l-${w.node.id}`}
            id={`lp-${w.node.id}`}
            at={at}
            // A directory's name sits ON its plate, so the plate picks the ink — and at
            // the plate's own opacity, because under Surprise it is damped to 0.6 and
            // what the eye gets is the stop composited over the pane. An unanalyzed
            // plate is `--structure`, a near-background neutral, and takes the chrome's
            // foreground: background-on-background is why these went invisible the
            // moment the plates stopped being outlined in white.
            //
            // A FILE's name is not on anything. It hangs off the rim, past the outermost
            // ring, on ground that belongs to nobody — so the ground's own ink is the
            // right one, and it is set quieter than the structure it labels.
            // A directory's plate is now always the structural neutral — its reading
            // moved to the rim (`DIR_RIM_PX`) — so the ink that used to be derived
            // from the plate's own stop is the chrome's, which is what an unread
            // plate already took. One case where there were two.
            //
            // **A directory's name is set in the muted ink, not the full one.** It was
            // `--foreground` at 0.9, which is near-black on a light plate and near-white
            // on a dark one — the loudest thing available, spent on the label of a
            // container. It is a name, not a reading: the wedges under it carry the
            // measurement and the rim carries the distribution, and a heading printed
            // at full contrast over both competes with the picture it is heading.
            //
            // **The ink, let through at a fraction, rather than a quieter ink.**
            // `--muted-foreground` was tried and is the failure in the other direction:
            // it is `#8b8279` and the plate is `#d0c9bd`, two steps apart on one warm
            // grey ramp, so the name and its ground were nearly the same value.
            //
            // A fraction of the full ink composites INTO a slate instead of being one —
            // `#5f5c55` on the light plate, `#adaaa4` on the dark — so the colour comes
            // from the plate showing through and follows it wherever it goes, which a
            // chosen third colour cannot. It is the same thing the rim's filenames do
            // one alpha down, which is why the two read as one family.
            //
            // Directories sit a little above files because their ground is darker: the
            // same alpha over a mid-tone plate lands quieter than over the pane.
            fill={CHROME_INK}
            opacity={(isDir ? 0.68 : 0.62) * (at.clipped ? 0.72 : 1)}
          />
        )
      })
  )
}
