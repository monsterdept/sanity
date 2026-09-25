import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from 'react'
import { type Node } from '../lib/api'
import { type Sector } from '../lib/fan'
import { lerpView, viewBoxOf, type Geo, type View } from '../lib/zoom'
import { HUB_BADGE_Y } from './FindingBadge'
import { viewOf } from './mapModel'

/*
 * Where the map sits in its pane: the pane's measured size, and the box the picture is fitted
 * to — written straight to the SVG element and to the badge over the hub, every frame, rather
 * than through state. See `useMapView`.
 */

type Box = { w: number; h: number }
/** Put the badge where the hub lands, for a pane `w` by `h` — see `useMapView`'s `place`. */
type Place = (w: number, h: number) => void

/** The pane's size, measured rather than inferred from pointer traffic.
 *
 *  `box` was only written in `onMouseMove`, which is fine for placing a tooltip — the
 *  pointer is by definition inside — and useless for deciding a layout, because it is
 *  {0,0} until someone moves the mouse over the chart. A threshold read off that would
 *  have been the fallback on every fresh render and then silently changed the picture
 *  the first time the pointer crossed it.
 *
 *  `place` is a ref because what it holds is written by `useMapView`, further down the render
 *  that this observer outlives. */
export function usePaneBox(
  pane: RefObject<HTMLDivElement | null>,
  place: MutableRefObject<Place>,
): [Box, Dispatch<SetStateAction<Box>>] {
  const [box, setBox] = useState<Box>({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = pane.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      // **Placed here as well as in the frame loop.** An observer callback runs before the
      // paint that the resize causes, so the badge moves on the same frame as the wedges;
      // waiting for the state below to come back through a render puts it one frame behind
      // for every frame of a drag, which is the hub stuttering inside a smooth map.
      place.current(width, height)
      setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [box, setBox]
}

/** A `place` that has nowhere to put anything yet. */
export const PLACE_NOWHERE: Place = (w, h) => {
  void w
  void h
}

/** Fit the box to the composition, after it has been drawn.
 *
 *  `getBBox` reports the union of everything rendered — arcs, labels, the hub — in user
 *  units, which are independent of the viewBox. That independence is what makes this
 *  safe to run on every layout: changing the box cannot change the measurement, so
 *  there is no loop to converge.
 *
 *  Centered on the CONTENT, not on the origin. The origin is the hub, and the hub is
 *  only the middle of the composition when the painted wedges happen to be symmetric
 *  about it — which depends entirely on the repo. Squaring about the origin fit the
 *  extent correctly and then hung it off-center: the same map sat high on one project
 *  and low on the next, by however lopsided that project's outer ring was.
 *
 *  Square, because the rings are a circle and a tight rectangular crop would scale the
 *  two axes differently through `xMidYMid` and oval them. The larger dimension decides,
 *  so nothing is cropped. */
export function useMapView({
  target,
  root,
  fileFrom,
  paneAspect,
  fileIds,
  morph,
  rIn,
  run,
  moving,
  e,
  box,
  findings,
  svg,
  hubBadge,
  place,
}: {
  target: Map<string, Geo>
  root: Node
  /** The wedge an open file grew out of, as the level change left it this render. */
  fileFrom: Sector | null
  paneAspect: number
  fileIds: ReadonlySet<string>
  morph?: boolean
  rIn: number
  /** The level change in progress — the box re-bases once per run. */
  run: number
  moving: boolean
  e: number
  box: Box
  /** Only its identity is read: a badge layer that mounts again has to be placed again. */
  findings: unknown
  svg: RefObject<SVGSVGElement | null>
  hubBadge: RefObject<HTMLDivElement | null>
  place: MutableRefObject<Place>
}): { viewBox: string; viewNow: RefObject<View> } {
  /** The drawn extent, in user units. Square, so the composition does not stretch. Held
   *  on the element and in a ref rather than in state — see the fit effect. */
  const fitted = useRef('-360 -360 720 720')
  /** Where the box wants to be for the level being drawn, and where it was for the last
   *  one. Interpolated together with the wedges, so the zoom and the movement are one
   *  thing rather than two that happen to overlap. */
  const viewTo = useMemo(
    () =>
      viewOf({
        target,
        rootKind: root.kind,
        fileFrom,
        paneAspect,
        fileIds,
        morph: !!morph,
        rIn,
      }),
    // `fileFrom` is a ref, rewritten only by a level change, which moves `root.id`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [target, root.kind, root.id, paneAspect, fileIds, morph, rIn],
  )
  const viewFrom = useRef(viewTo)
  const viewNow = useRef(viewTo)
  /** Put the badge where the hub's user-space origin lands, for a pane of this size.
   *
   *  **Held in a ref so the RESIZE observer can call it too, and that is the whole point.**
   *  The pane's size reaches this component as state, so on a window drag the SVG rescaled
   *  itself natively every frame while the badge waited for a React render — one frame
   *  behind, every frame, which is a hub that stutters while everything around it is smooth.
   *  The observer runs before paint, so placing it from there puts the badge on the same
   *  frame as the box it sits in. The effect below still calls it, because the view also
   *  moves without the pane changing at all. */
  place.current = (w: number, h: number) => {
    const el = hubBadge.current
    if (!el || w <= 0 || h <= 0) return
    const v = viewNow.current
    const s = Math.min(w, h) / v.side
    const x = w / 2 + (0 - v.cx) * s
    const y = h / 2 + (HUB_BADGE_Y - v.cy) * s
    el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(${s})`
    // Hidden until it has been placed. Untransformed it sits in the pane's top-left corner,
    // which is a badge in the wrong place for however long the first measurement takes — and
    // `findings` in the effect's deps is what re-places it after a replay is switched off and
    // the layer mounts again with no transform on it.
    el.style.visibility = 'visible'
  }
  /** The run the box has been re-based for, so it re-bases once per level and not once
   *  per frame. */
  const startedRun = useRef(0)
  if (startedRun.current !== run) {
    startedRun.current = run
    viewFrom.current = viewNow.current
  }
  useLayoutEffect(() => {
    const v = moving ? lerpView(viewFrom.current, viewTo, e) : viewTo
    viewNow.current = v
    const next = viewBoxOf(v)
    // Written straight to the element rather than through state. Through state this is a
    // second React render for every frame — one to move the wedges, one to resize the box
    // around them — which was most of what made the motion feel heavy. Nothing else reads
    // the attribute, and it is derived from geometry this component already has.
    if (svg.current && fitted.current !== next) {
      fitted.current = next
      svg.current.setAttribute('viewBox', next)
    }
    // The hub is the user-space origin, always — so where it lands on screen is the box's
    // own arithmetic and nothing has to be measured. The viewBox is square and the SVG is
    // fitted `xMidYMid`, so one scale serves both axes and the middle of the box is the
    // middle of the pane. Written here rather than in its own effect because it has to move
    // on the SAME frame as the wedges: a badge that arrives one frame late slides across
    // the map behind the disc it belongs to.
    place.current(box.w, box.h)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewTo, e, moving, box.w, box.h, findings])
  return { viewBox: fitted.current, viewNow }
}
