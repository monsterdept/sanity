import { trapOf, unreadable } from '../lib/api'
import { clsx } from '../lib/cn'
import { colorFor, paintsFromReadings, type Paint } from '../lib/colorMode'
import { CHROME_INK, inkBy, type Resolve } from '../lib/ink'
import { arcPath, tileFunctions, type Wedge } from '../lib/sunburst'
import { type Geo } from '../lib/zoom'
import { RollupDots, dotsId, ROLLUP_TEXTURE_PX } from './RollupDots'
import { WedgeLabel } from './WedgeLabel'
import { fitLabel, type Measure } from '../lib/label'
import { WEIGHT } from '../lib/labelStyle'
import { type MapHandlers, type MapModel } from './mapModel'
import { type Node } from '../lib/api'

/** A function's name inside its file's band: the same treatment the fan gives it, at the
 *  smaller scale the ring can afford. The WEIGHT is not here — it is live, in
 *  `labelStyle`, and it has to be, because `fitLabel` measures in the weight
 *  `WedgeLabel` draws in and a constant on one side of that pair is the same bug as a
 *  constant face was. */
const FUNC_MAX = 11
const FUNC_BEND = 0.45

/** One file's functions as they are tiled this frame, or `slots: null` when its wedge has no
 *  room to tile them. */
export type Tiled = Array<{ w: Wedge; slots: ReturnType<typeof tileFunctions> | null }>

/** Where every file's functions land this frame — laid out once, and read by both the patches
 *  and the marks (`marksOf`), so the outline and the patch it outlines are one tiling. */
export function tilingsOf(m: MapModel, geo: (id: string) => Geo): Tiled {
  const { fileWedges, tilingOf, minPatchArea } = m
  return fileWedges.map((w) => {
    // Inside the file's OWN band — (depth - 1) — not the one beyond it. Inset
    // on both radii so the file's fill reads as a rim on the inside and outside
    // edges too, not just the angular sides.
    // **From `geo`, not from the wedge.** The tiling used to be laid out straight
    // off the layout's own angles, which is the wedge's FINAL position — fine while
    // the only thing that moved was a level change, because patches are not drawn
    // during one. Once the rings can ease toward a shape that changed under them,
    // a file's functions laid out at the target while its wedge is still on its way
    // there are functions hanging outside their own file. One source for both.
    // Inside the file's OWN band — (depth - 1) — not the one beyond it, inset on
    // both radii so the file's fill reads as a rim on the inside and outside edges
    // too, and angularly so it frames its own functions on both sides. All of that
    // is `tilingOf`, which also answers whether there is room at all:
    //
    // Too small to say anything: draw the file solid instead. The test is AREA —
    // the arc floor that used to carry it alone was written for a radial stack,
    // where a file's whole angular width WAS one slice; tiling spends both
    // dimensions, so a wedge can be narrow and still hold plenty, and the old rule
    // was silencing files that had the room. Four patches rather than one, because
    // a wedge with room for a single patch draws its own roll-up over its own area
    // and says nothing the file's fill was not already saying. The file keeps its
    // own fill and its own hover, and drilling in still shows every function it
    // has; `layout` culls wedges below `MIN_ANGLE` on the same reasoning, and this
    // is that rule one level further in, where the wedges are not culled but their
    // CONTENTS cannot be drawn.
    //
    // **From `geo`, not from the wedge.** The tiling used to be laid out straight
    // off the layout's own angles, which is the wedge's FINAL position — fine while
    // the only thing that moved was a level change, because patches are not drawn
    // during one. Once the rings can ease toward a shape that changed under them,
    // a file's functions laid out at the target while its wedge is still on its way
    // there are functions hanging outside their own file. One source for both.
    const tile = tilingOf(geo(w.node.id))
    if (!tile) return { w, slots: null }
    const { r0, r1, fa0, fa1 } = tile
    return { w, slots: tileFunctions(w.node.children, r0, r1, fa0, fa1, { minPatchArea }) }
  })
}

/** Functions tiled inside their files' wedges, each with its marks and its name. */
export function Patches({
  m,
  tiled,
  hover,
  tagNodes,
  measure,
  ink,
  on,
}: {
  m: MapModel
  tiled: Tiled
  hover: Node | null
  tagNodes: boolean
  measure?: Measure
  ink?: Resolve
  on: MapHandlers
}) {
  const { mode, ranks, views, unitsPerPx, replaying, selected, pulsing, cutAt } = m
  /** The ink a name takes on the patch it stands on — the same judgement `colorFor` made, asked
   *  of this picture's colours rather than the document's when somebody said what they are. */
  const inkOf = (c: Paint) => (ink ? inkBy(ink, c.stop) : c.ink)
  return tiled.map(({ w, slots }) => {
    if (!slots) return null
    return slots.map((slot) => {
      const c = colorFor(slot.node, mode, ranks, views)
      const isSel = selected?.id === slot.node.id
      const isHover = hover?.id === slot.node.id
      const d = arcPath(slot.a0, slot.a1, slot.r0, slot.r1)
      return (
        <g key={slot.node.id}>
          <path
            data-node={tagNodes ? slot.node.id : undefined}
            data-arc={tagNodes ? `${slot.a0} ${slot.a1} ${slot.r0} ${slot.r1}` : undefined}
            // The pulse is a CLASS, not a prop: `opacity` animated in CSS is
            // compositor-only, so hundreds of these cost nothing per frame — which is
            // the bar anything decorative has to clear in this app.
            className={clsx(
              'wedge',
              mode === 'traps' && trapOf(slot.node.agent) && !slot.node.agentStale && 'trap-pulse',
              // The same breath for the same reason — copies are 1–8% of a repo, which
              // is the density where a colour alone means hunting. See `--clone`.
              mode === 'clones' && slot.node.cloneSize != null && 'trap-pulse',
            )}
            d={d}
            fill={c ? c.fill : 'var(--unanalyzed)'}
            fillOpacity={isSel || isHover ? 1 : c ? 0.92 : 0.4}
            // No per-wedge source mark. It existed to tell agent verdicts from
            // model ones, but with MCP as the primary mode everything is
            // agent-judged — a mark on every item is stripes, not information. The
            // detail panel names the instrument for the one wedge you asked about.
            stroke="var(--background)"
            strokeWidth={cutAt('func', slot.a0, slot.a1, slot.r0)}
            onMouseEnter={() => on.hover(slot.node)}
            onMouseLeave={() => on.hover((n) => (n?.id === slot.node.id ? null : n))}
            onClick={(e) => {
              e.stopPropagation()
              on.select(slot.node)
            }}
            // Same gesture as a directory, one level further: double-clicking a
            // function opens the file it lives in, at the function.
            onDoubleClick={(e) => {
              e.stopPropagation()
              on.drill(slot.node)
            }}
          ></path>
          {/* Drawn over the wedge, deaf to the mouse so the wedge underneath keeps
              every gesture. The wedge itself has already fallen back to the proxy
              color — `applyAgentReports` drops a stale reading's score — so
              without this the only sign a function was ever read would be in the
              panel, one wedge at a time. The whole argument for a map is that you
              can see where the problem is without clicking.

              **Surprise only, because staleness is a fact about a READING and only
              this mode is painted from readings.** In blame the color is an author,
              in age a date, in language an extension — none of which expire when a
              body changes. A hatch there marks the wedge as untrustworthy in an
              encoding it cannot be untrustworthy in: the author of a function that
              was edited is not in doubt. It read as damage to the layer underneath,
              which is the same sin as a stale reading keeping its color, pointed the
              other way. */}
          {paintsFromReadings(mode) && slot.node.agentStale && (
            <path className="pointer-events-none" d={d} fill="url(#stale-hatch)" />
          )}
          {/* Too large for any reading — see `unreadable`. Drawn on the same
              lenses as the stale hatch and for the mirrored reason: it is a fact
              about whether a READING can exist, so it belongs where readings are
              the encoding and nowhere else. Under Blame this wedge has an author
              like any other, and marking it there would call a fact about our own
              limits a defect in somebody's code. */}
          {paintsFromReadings(mode) && unreadable(slot.node) && (
            <path className="pointer-events-none" d={d} fill="url(#unreadable-hatch)" />
          )}
          {/* **In a replay, NOT YET READ is drawn rather than left blank.** The
              frames carry the readings the repo held at each commit, so under these
              three lenses a function without one is a fact about that moment — nobody
              had looked yet — and the whole point of folding the shards is watching
              that hatch clear as the story runs. Traps is left out: there, an absence
              is already drawn as the structural neutral and hatching every unread
              wedge would cover a map whose finding is the handful that are marked. */}
          {replaying &&
            mode !== 'traps' &&
            paintsFromReadings(mode) &&
            slot.node.kind === 'func' &&
            !slot.node.agent && (
              <path
                className="pointer-events-none"
                d={d}
                fill="url(#stale-hatch)"
                opacity={0.5}
              />
            )}
          {/* Out with a reader — the same marker the file wedges take, applied one
              level in. Both are needed: a file reading pulses the file's band, and a
              function reading has to pulse the patch, because the patches are drawn
              ON TOP of their file's wedge and would otherwise hide the very mark
              that says where the work is. */}
          {pulsing?.has(slot.node.id) && (
            <path className="wedge-reading" d={d} pointerEvents="none" fill="var(--foreground)" />
          )}
          {/* A roll-up is drawn like a function and is the largest patch in its
              file, so at any real size it reads as one enormous cold function
              rather than as the hundreds it stands for. The dots say otherwise —
              see `RollupDots`.

              Only when there is room for the texture to BE one, and the threshold
              costs nothing: a roll-up is large exactly when its members carry a lot
              of lines, which is the same condition that makes it mistakable. The
              ones below the cut measure three to eight pixels on the short side and
              nobody was going to read those as one big function anyway. Measured
              across depths and file sizes, the two populations fall either side of
              ten pixels with nothing in between. */}
          {slot.node.rest !== undefined &&
            unitsPerPx !== null &&
            Math.min((slot.a1 - slot.a0) * ((slot.r0 + slot.r1) / 2), slot.r1 - slot.r0) /
              unitsPerPx >=
              ROLLUP_TEXTURE_PX && (
              <>
                {/* Keyed on the FILE, not the roll-up's own node. The aggregate is
                    synthetic and its id is minted from the path, so it is stable per
                    file and there is exactly one roll-up in a file's wedge. */}
                <RollupDots
                  id={dotsId(w.node.path)}
                  angle={(slot.a0 + slot.a1) / 2}
                  // The patch's own middle, so the lattice is centered on it rather
                  // than on the hub. Mid-angle at mid-radius: not the true centroid
                  // of an annular sector, which sits a little outward of it, but the
                  // dots are a texture and the difference is under a tile.
                  cx={((slot.r0 + slot.r1) / 2) * Math.sin((slot.a0 + slot.a1) / 2)}
                  cy={-((slot.r0 + slot.r1) / 2) * Math.cos((slot.a0 + slot.a1) / 2)}
                />
                <path className="pointer-events-none" d={d} fill={`url(#${dotsId(w.node.path)})`} />
              </>
            )}
          {/* And its name, if the patch can hold one.
              The old rule was that functions are never labeled here, on the grounds
              that they are laid out angularly by `layout` but DRAWN tiled inside
              their file's band — so a name placed from the layout angle lands nowhere
              near the patch it names. True, and it argued against the wrong thing:
              the tiling hands back the patch's REAL geometry, which is what the fan
              has always labeled from. Fitting to `slot` rather than to the wedge is
              the whole difference, and a file drawn large enough has room for several.

              The fan's tight bend, not the ring's generous one. These are treemap
              cells that happen to sit in a band; there is no ring for a curve to
              belong to at this scale — see `DEFAULT_BEND`. */}
          {(() => {
            const at = fitLabel(slot, slot.node.name, {
              weight: WEIGHT,
              max: FUNC_MAX,
              maxBend: FUNC_BEND,
              measure,
            })
            return at ? (
              <WedgeLabel
                id={`fn-${slot.node.id}`}
                at={at}
                // The patch this name is standing ON decides the ink — see `ink.ts`.
                // An unread patch is `--unanalyzed` at 0.4, which is nearly the
                // ground, so it keeps the chrome's own foreground.
                fill={c ? inkOf(c) : CHROME_INK}
                opacity={at.clipped ? 0.6 : 0.85}
              />
            ) : null
          })()}
        </g>
      )
    })
  })
}
