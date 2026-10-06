import { useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { type Node } from '../lib/api'
import { type Wedge } from '../lib/sunburst'
import { sectorOf, type Sector } from '../lib/fan'
import {
  direction,
  ease,
  enterFrom,
  exitTo,
  lerpGeo,
  hubGeo,
  ZOOM_MS,
  type Direction,
  type Exiting,
  type Geo,
} from '../lib/zoom'
import { FUNC_RIM, FUNC_RIM_MAX_SHARE, R_OUTER, type Frame } from './mapModel'

/*
 * How the map moves on its own, as one hook: every motion `Sunburst` runs, handed back as the
 * `Frame` `MapSvg` draws.
 *
 * Three sources, and one of them owns the picture at a time. A LEVEL CHANGE — drilling in,
 * popping out, opening or closing a file — is a keyframe (`t`, eased) that flies the old level
 * out, cores the clicked directory into the hub, and unrolls or rolls up a file's tiling. The
 * CHASE eases every wedge toward a target that moved without the level changing: a replay's
 * next commit, or a fold. And at rest, `geo` is the layout's own geometry. See `geo` for the
 * order they are asked in.
 *
 * Everything that has to survive between frames is a ref, and everything the loops write is
 * written between renders — see each one for why it is not state.
 */

/** How fast a ring catches up with a shape that changed under it, as a time constant in ms.
 *
 *  **History moves the picture without changing the LEVEL, and nothing was animating that.**
 *  The zoom machinery below is keyed on the root changing identity — drill in, pop out — so
 *  a replay, which keeps the same root and hands the renderer a different tree thirty times
 *  a second, went straight to the new geometry every frame. Every commit landed as a snap.
 *
 *  Exponential rather than a keyframe, and that is the whole reason this is affordable. A
 *  keyframed tween has to be STARTED, which means noticing that a target changed, deciding
 *  how long the move should take, and being interrupted by the next commit before it lands —
 *  three problems a replay creates constantly. Easing a fraction of the remaining distance each
 *  frame has no start, no end and no state beyond where the rings are now: a target that
 *  moves again mid-flight is simply the next thing being chased. Frame-rate independent
 *  through `1 - exp(-dt/tau)`, so it eases the same on a slow machine as on a fast one.
 *
 *  Tuned against a replay rather than against a single step: at 90ms a wedge covers most of
 *  its distance inside a frame's own dwell time, so a commit still reads as an event instead
 *  of smearing into the next one. */
const MORPH_TAU_MS = 90

/** Close enough to be there, in user units and radians. Without a floor the chase never
 *  formally ends, and a re-render every frame forever is the cost of the last hundredth of a
 *  pixel. */
const MORPH_EPS = 0.02

/** Where every wedge is, as the map hands it to `MapSvg` — see the note at the top of the file for
 *  the three sources and the order they are asked in. This is the composition: the state the
 *  level change and the chase share, each of them in turn, and the frame that reads them. */
export function useLevelMotion({
  root,
  wedges,
  target,
  rIn,
  morph,
}: {
  root: Node
  /** The wedges of the level being drawn — kept, so the one being left can fly out. */
  wedges: Wedge[]
  /** Where every wedge in this layout belongs — see `buildModel`. */
  target: Map<string, Geo>
  rIn: number
  /** Ease toward a changed shape rather than taking it — see `Sunburst`'s `morph`. */
  morph?: boolean
}) {
  /** How far through the level change we are, 0..1. `1` means nothing is moving.
   *
   *  Driven by a rAF loop rather than CSS, because what is being animated is the wedges'
   *  own geometry — see `zoom.ts` for why that is worth paying for and how it stays
   *  affordable. React re-renders per frame, which is fine at a couple of hundred arcs:
   *  the function patches, which are the thousands, are not drawn while this is running. */
  const [t, setT] = useState(1)
  /** Bumped once per level change, so the frame loop below knows a new run has begun
   *  without depending on the value that run is writing. */
  const [run, setRun] = useState(0)
  /** Where every wedge is RIGHT NOW, whether or not it has arrived.
   *
   *  Written every frame, which is what makes an interrupted transition start from the
   *  picture on screen instead of from wherever the last one began. Double-clicking twice
   *  quickly used to restart the keyframe from its own beginning, so the second move
   *  visibly jumped backwards before going forwards. */
  const live = useRef<Map<string, Geo>>(new Map())
  const chase = useChaseState(morph)
  const { leaving, coring, from, fileFrom, fileLeaving } = useLevelChange({
    root,
    wedges,
    target,
    rIn,
    live,
    setT,
    setRun,
  })
  useKeyframe(run, setT)
  useChase({ ...chase, morph, target, live })
  const { soft, chasing } = chase

  const moving = t < 1
  const e = ease(t)
  /** A wedge's geometry for this frame: where it belongs once nothing is moving, and on
   *  the way there while something is.
   *
   *  Three sources, in order of who owns the picture. A level change owns it outright, so
   *  the keyframe wins while it runs. Otherwise, if the caller asked for morphing, the eased
   *  position is the truth — including for a wedge nobody has seen before, which is SEEDED
   *  here at zero width so it opens rather than appearing. Seeding has to happen here and
   *  not in the loop below: a wedge drawn at its target for one frame and then rewound to
   *  nothing is a flicker, and it is the first thing a new file would do in a replay. */
  const geo = (id: string): Geo => {
    const to = target.get(id)
    if (!to) return { a0: 0, a1: 0, r0: 0, r1: 0 }
    if (moving) {
      const f = from.current.get(id)
      return f ? lerpGeo(f, to, e) : to
    }
    if (!chasing) return to
    const known = soft.current.get(id)
    if (known) return known
    const mid = (to.a0 + to.a1) / 2
    const seeded = { a0: mid, a1: mid, r0: to.r0, r1: to.r1 }
    soft.current.set(id, seeded)
    return seeded
  }
  // Keep the chase pointed at what is being drawn now.
  chase.softTarget.current = target
  chase.softMoving.current = moving

  // Where the picture IS, recorded for whatever interrupts it. Without this an
  // interrupted transition would restart from the last run's starting positions and the
  // ring would visibly snap backwards before setting off again.
  {
    const now = new Map<string, Geo>()
    for (const id of target.keys()) now.set(id, geo(id))
    live.current = now
  }

  const frame: Frame = {
    geo,
    moving,
    e,
    leaving: leaving.current,
    coring: coring.current,
    fileLeaving: fileLeaving.current,
  }
  return {
    frame,
    moving,
    e,
    /** Bumped once per level change — what the box re-bases on. */
    run,
    /** The wedge an open file grew out of, as of this render. */
    fileFrom: fileFrom.current,
    /** Turn the chase on for a fold, before the layout it eases toward arrives — see `folding`. */
    armFold: () => chase.setFolding(true),
  }
}

/** The chase's own state: where the rings are while they ease, what they are easing toward, and
 *  whether a fold rather than a replay is what turned it on. Declared where it always was, before
 *  the level change's refs, so the hooks are called in the order they always were. */
function useChaseState(morph: boolean | undefined) {
  /** Where the rings are while they ease toward a shape that changed under them — see
   *  `MORPH_TAU_MS`. Empty unless the caller asked for morphing, and cleared on a level
   *  change, which owns the picture outright while it runs.
   *
   *  The entries are MUTATED rather than replaced. The chase touches every structural wedge
   *  on every frame of a replay, and handing the collector a few hundred fresh objects
   *  thirty times a second is the hitch-on-a-fixed-period this app has already paid for once,
   *  in the frame pool. */
  const soft = useRef<Map<string, Geo>>(new Map())
  /** A fold is being eased, which is the chase running for a reason that is not a replay.
   *
   *  Folding hands a subtree's angle to its siblings, so one ⌥-click re-proportions every
   *  wedge in the ring and everything under them. Applied instantly that is the whole map
   *  jumping — the same hard cut `zoom.ts` was written to remove from level changes, and
   *  worse here, because nothing about a fold tells you where anything went.
   *
   *  It rides the chase rather than growing a second animator: the machinery for "the shape
   *  changed under the picture, walk it there" already exists for the replay, and a fold is
   *  exactly that. What it must not do is turn on the things `morph` ALSO gates — the box is
   *  pinned to the nominal circle during a replay, and a fold has no business moving the
   *  camera. So the chase is gated on `chasing` and everything else stays on `morph`. */
  const [folding, setFolding] = useState(false)
  const chasing = !!morph || folding
  /** What the chase is chasing, and whether a level change has taken the picture off it.
   *  Refs because the loop runs between renders and must not hold the frame it started on. */
  const softTarget = useRef<Map<string, Geo>>(new Map())
  const softMoving = useRef(false)
  /** Bumped by the chase to draw its next frame. Nothing reads the value. */
  const [, redraw] = useState(0)
  return { soft, setFolding, chasing, softTarget, softMoving, redraw }
}

/** A level change — drilling in, popping out, opening or closing a file — noticed during render
 *  and set up as the keyframe's start: where everything flies from, what flies out, what cores
 *  into the hub, and the file tiling that unrolls or rolls back up. Hands back the refs the frame
 *  reads, so the frame reads them as of this render. */
function useLevelChange({
  root,
  wedges,
  target,
  rIn,
  live,
  setT,
  setRun,
}: {
  root: Node
  wedges: Wedge[]
  target: Map<string, Geo>
  rIn: number
  /** Where every wedge is on screen — see `live` in `useLevelMotion`. Read here, never written. */
  live: RefObject<Map<string, Geo>>
  setT: Dispatch<SetStateAction<number>>
  setRun: Dispatch<SetStateAction<number>>
}) {
  /** The wedges of the level being left, so they can be animated out rather than dropped.
   *  The old transition unmounted them, which is why changing level read as a hard cut
   *  with an ease-in after it rather than as one movement. */
  const leaving = useRef<Exiting[]>([])
  /** The directory being opened, on its way into the middle. Its own thing rather than an
   *  entry in `leaving`, because it is not leaving — it is arriving as the hub. */
  const coring = useRef<{ node: Node; from: Geo; to: Geo } | null>(null)
  const from = useRef<Map<string, Geo>>(new Map())
  /** The wedge an open file grew out of. See the level-change block below. */
  const fileFrom = useRef<Sector | null>(null)
  /** The file being closed, retracting into the wedge it came out of.
   *
   *  Its own thing rather than an entry in `leaving`, for the same reason `coring` is: it
   *  is not an arc flying outward, it is a tiling rolling back up. Without it, closing a
   *  file was the hard cut this whole approach removed in the other direction — the cells
   *  unmounted on the frame the root changed and the rings eased in over nothing.
   *
   *  It retracts into the sector it CAME from, not into wherever the file lands in the new
   *  level. In the ordinary case — going back up to the parent — those are the same wedge,
   *  because the level being returned to is the one the file was opened from. Reusing the
   *  source guarantees the first frame of the exit is exactly the picture on screen, where
   *  re-deriving it would risk a pop on a jump that reorganized the ring. */
  const fileLeaving = useRef<{ node: Node; from: Sector } | null>(null)
  const prevRoot = useRef(root)
  const dir = useRef<Direction>('across')

  /** The wedges of the level currently on screen, kept so the one being left can still be
   *  drawn on its way out. Declared before the check below uses it. */
  const prevWedges = useRef<Wedge[]>(wedges)

  // A level change, detected during render so the first painted frame is already the
  // first frame of the motion — an effect would show one frame of the destination first,
  // which is exactly the cut this replaces.
  if (prevRoot.current.id !== root.id) {
    dir.current = direction(prevRoot.current.path, root.path)
    // Everything starts from where it is on screen, not from where it was when the last
    // transition began. For a wedge that was not visible at all, `enterFrom` finds the
    // nearest ancestor it can have come out of.
    const was = live.current
    const start = new Map<string, Geo>()
    for (const [id, g] of target) start.set(id, was.get(id) ?? enterFrom(id, g, was))
    from.current = start
    // The wedge you clicked BECOMES the hub, and that is the one piece of this motion the
    // reader is actually following. `layout` never emits the root as a wedge, so without
    // this the directory being opened is simply absent from the new level and falls into
    // the pile below — it flew outward with the siblings it was replacing, which says the
    // opposite of what happened.
    //
    // Going the other way it is the same journey reversed: the level you are leaving was
    // the hub a moment ago, so it comes OUT of the middle rather than growing from
    // nothing at the edge.
    const hub = hubGeo(rIn)
    coring.current =
      dir.current === 'in' && was.has(root.id)
        ? { node: root, from: was.get(root.id) as Geo, to: hub }
        : null
    const cameFrom = prevRoot.current
    if (dir.current === 'out' && target.has(cameFrom.id)) {
      start.set(cameFrom.id, hub)
    }
    // What was on screen and is not in the new level. Rendered through the transition on
    // its way out, then dropped. The clicked wedge is excluded: it has somewhere better
    // to be.
    leaving.current = prevWedges.current
      .filter((w) => !target.has(w.node.id) && was.has(w.node.id) && w.node.id !== root.id)
      .map((w) => ({
        node: w.node,
        depth: w.depth,
        index: w.index,
        from: was.get(w.node.id) as Geo,
        to: exitTo(was.get(w.node.id) as Geo, dir.current, rIn, R_OUTER),
      }))
    // A file is a destination rather than a level: the rings do not reorganize around it,
    // its own tiling unrolls into the pane. What that needs is the one thing only this
    // moment has — where the file's wedge stood on screen just before it was opened. The
    // insets match the ones the patch renderer applies, because a source sector a few
    // units off is a first frame that jumps, which is the whole thing this avoids.
    // A file being closed: keep its cells alive through the transition, rolling back up.
    fileLeaving.current =
      prevRoot.current.kind === 'file' && root.kind !== 'file' && fileFrom.current
        ? { node: prevRoot.current, from: fileFrom.current }
        : null
    if (root.kind === 'file') {
      const g = was.get(root.id)
      if (g) {
        const rMid = (g.r0 + g.r1) / 2
        const pad = Math.min(FUNC_RIM / rMid, (g.a1 - g.a0) * FUNC_RIM_MAX_SHARE)
        fileFrom.current = sectorOf(g.a0 + pad, g.a1 - pad, g.r0 + FUNC_RIM, g.r1 - FUNC_RIM)
      } else {
        // Never on screen — a restored session, or a project opened straight into a file.
        // Nothing to come out of, so it is drawn where it lands rather than flown in from
        // a wedge that was never there.
        fileFrom.current = null
      }
    }
    prevRoot.current = root
    setT(0)
    setRun((r) => r + 1)
  }
  prevWedges.current = wedges
  return { leaving, coring, from, fileFrom, fileLeaving }
}

/** The rAF loop, started once per level change.
 *
 *  Keyed on `run` and NOT on `t`: a dependency on the value the loop is writing tears
 *  the effect down and rebuilds it every frame, and each rebuild re-reads the clock, so
 *  the transition restarts its own duration for as long as it runs. `run` changes once,
 *  when a level change begins. */
function useKeyframe(run: number, setT: Dispatch<SetStateAction<number>>) {
  useEffect(() => {
    if (run === 0) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(1)
      return
    }
    let raf = 0
    const started = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / ZOOM_MS)
      setT(p)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [run])
}

/** The chase: every frame, close some of the gap between where the rings are and the shape
 *  they have been given.
 *
 *  It runs for as long as morphing is on rather than being started and stopped per change,
 *  because a replay changes the target constantly and a loop that has to be re-armed is a
 *  loop that misses the first frame of every commit. Idle it costs one pass over a few
 *  hundred structural wedges — `geoOf` skips functions, so the thousands are not in here —
 *  and, crucially, no re-render: nothing moved, nothing is drawn.
 *
 *  It defers to the level change entirely. While the keyframe runs it copies what is on
 *  screen instead of easing, so the moment the zoom lands the chase is already holding the
 *  picture and there is nothing to jump from. */
function useChase({
  soft,
  setFolding,
  chasing,
  softTarget,
  softMoving,
  redraw,
  morph,
  target,
  live,
}: ReturnType<typeof useChaseState> & {
  morph: boolean | undefined
  target: Map<string, Geo>
  live: RefObject<Map<string, Geo>>
}) {
  useEffect(() => {
    if (!chasing) {
      soft.current.clear()
      return
    }
    let raf = 0
    let prev = performance.now()
    const step = (now: number) => {
      raf = requestAnimationFrame(step)
      // Clamped: a backgrounded tab hands back one enormous delta, and a frame that closes
      // 100% of every gap is the snap this exists to remove, arriving all at once on return.
      const dt = Math.min(120, now - prev)
      prev = now
      const to = softTarget.current
      const at = soft.current
      if (softMoving.current) {
        for (const [id, g] of live.current) {
          const cur = at.get(id)
          if (cur) Object.assign(cur, g)
          else at.set(id, { ...g })
        }
        return
      }
      const k = 1 - Math.exp(-dt / MORPH_TAU_MS)
      let busy = false
      for (const [id, g] of to) {
        const cur = at.get(id)
        // Unseeded wedges are the renderer's business — see `geo`. Skipping them here means
        // one that appears between frames opens on the next one rather than half-open.
        if (!cur) continue
        if (
          Math.abs(cur.a0 - g.a0) < MORPH_EPS &&
          Math.abs(cur.a1 - g.a1) < MORPH_EPS &&
          Math.abs(cur.r0 - g.r0) < MORPH_EPS &&
          Math.abs(cur.r1 - g.r1) < MORPH_EPS
        ) {
          // Snapped rather than left a hundredth of a unit short: an asymptote that never
          // arrives is a re-render every frame forever.
          Object.assign(cur, g)
          continue
        }
        cur.a0 += (g.a0 - cur.a0) * k
        cur.a1 += (g.a1 - cur.a1) * k
        cur.r0 += (g.r0 - cur.r0) * k
        cur.r1 += (g.r1 - cur.r1) * k
        busy = true
      }
      // A wedge that has left the tree stops being chased. It is not animated out: what a
      // deletion looks like is the wedges beside it closing over the space, which they do,
      // because they are chasing a target that no longer leaves room for it.
      if (at.size > to.size) for (const id of at.keys()) if (!to.has(id)) at.delete(id)
      if (busy) redraw((n) => n + 1)
      // A fold's chase stops when it arrives; a replay's does not — see the note above on
      // why the loop is not re-armed per change. Clearing the flag unconditionally is safe
      // for both: `chasing` is an OR, so a replay goes on running on `morph` alone, and a
      // fold that happened DURING a replay would otherwise leave the flag set and the chase
      // running over the live map long after the replay ended. React bails out on an
      // unchanged value, so the common case is not a re-render.
      else setFolding(false)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [chasing, morph])

  /** Whether the chase was on for the previous render, so its FIRST render can be told
   *  from its later ones. */
  const wasMorphing = useRef(false)
  // **Morphing starts from the picture on screen, not from nothing.**
  //
  // `geo` seeds a wedge the chase has never heard of at zero angular width, so it opens
  // rather than appearing — right for a file that shows up mid-replay, and catastrophic
  // for the frame morphing is switched ON, when the chase has heard of nothing and every
  // wedge on screen is therefore new. The whole map collapsed to the hub for a frame and
  // then bloomed back out: pressing History on a large repo went blank, drew the live map
  // again, and only then drew the replay — three pictures in a third of a second, none of
  // which anybody asked for.
  //
  // Primed during RENDER and not in an effect, for the same reason the level change is
  // detected here: `geo` runs before any effect, so an effect would prime a map that had
  // already been seeded at zero and the blank frame would paint anyway.
  //
  // **A fold seeds from the opposite side, and it has to.** Priming from `target` is right
  // when the chase turns on because the PICTURE is about to start changing — pressing
  // History, where the target is already a different tree and morphing the live map into
  // the replay's first frame would be an animation nobody asked for. A fold is the other
  // case: the target changed in the very render the chase turned on, so seeding from it
  // means the wedges are already where they are going and one ⌥-click eases nothing at all.
  // `live.current` still holds the previous frame here — it is rewritten further down this
  // render — which is exactly the picture the fold has to move away from.
  if (chasing && !wasMorphing.current) {
    soft.current.clear()
    const seed = morph ? target : live.current
    for (const [id, g] of seed) if (target.has(id)) soft.current.set(id, { ...g })
  }
  wasMorphing.current = chasing
}
