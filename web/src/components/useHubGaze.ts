import { useEffect, useRef, type RefObject } from 'react'
import { startGaze, stepGaze, type Gaze, type Look } from '../lib/eyeGaze'

/** How often the picture's position on screen is measured again for the pointer. It moves only
 *  when the window does, and measuring every frame would lay out the whole map every frame. */
const MEASURE_MS = 500

/**
 * Run the creature's gaze (`lib/eyeGaze.ts`) for a picture in the hub, and hand each frame's look
 * to `draw`. Shared by the eye and the circles, so the two follow one engine rather than two
 * copies of the pointer arithmetic.
 *
 * `draw` writes attributes; nothing here renders. It is read through a ref, so a new `draw` (a
 * new radius) carries on from where the gaze is rather than starting it over.
 */
export function useHubGaze(
  /** What the pointer's direction is measured from. */
  target: RefObject<SVGGraphicsElement | null>,
  /** The creature's gaze targets, x right and **y up** — see `gaze` in `Sunburst` — or null. */
  gaze: Array<{ x: number; y: number }> | null,
  draw: (g: Gaze) => void,
  {
    followMouse = true,
    selected = null,
    idle = true,
  }: {
    /** Whether it moves of its own accord — see `idle` in `GazeInput`. */
    idle?: boolean
    /** Whether the pointer is something to look at. Off, it is as though there were none. */
    followMouse?: boolean
    /** The clicked wedge's direction, x right and **y up** like `gaze`, or null. */
    selected?: { x: number; y: number } | null
  } = {},
): void {
  // Read by the running loop rather than restarting it. Turned to the screen's y down here, once.
  const focus = useRef<Look[] | null>(null)
  useEffect(() => {
    focus.current = gaze && gaze.length > 0 ? gaze.map((d) => ({ x: d.x, y: -d.y })) : null
  }, [gaze])
  const paint = useRef(draw)
  useEffect(() => {
    paint.current = draw
  }, [draw])
  const follow = useRef(followMouse)
  useEffect(() => {
    follow.current = followMouse
  }, [followMouse])
  const wander = useRef(idle)
  useEffect(() => {
    wander.current = idle
  }, [idle])
  const picked = useRef<Look | null>(null)
  useEffect(() => {
    picked.current = selected ? { x: selected.x, y: -selected.y } : null
  }, [selected])

  useEffect(() => {
    let pointer: { x: number; y: number; at: number } | null = null
    const onMove = (e: MouseEvent) => {
      pointer = { x: e.clientX, y: e.clientY, at: performance.now() }
    }
    document.addEventListener('mousemove', onMove)

    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let box: DOMRect | null = null
    let measured = -Infinity
    let s = startGaze()
    let last = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const dt = Math.min(100, now - last)
      last = now
      let mouse: Look | null = null
      if (pointer && follow.current) {
        if (now - measured > MEASURE_MS) {
          box = target.current?.getBoundingClientRect() ?? null
          measured = now
        }
        if (box && box.width > 0) {
          const vx = pointer.x - (box.left + box.width / 2)
          const vy = pointer.y - (box.top + box.height / 2)
          // As the creature does it: the pointer's direction, softened near the picture by a
          // depth the size of the picture, so a pointer right on it looks nearly straight ahead.
          const len = Math.sqrt(vx * vx + vy * vy + box.width * box.width)
          mouse = { x: vx / len, y: vy / len }
        }
      }
      const out = stepGaze(s, dt, {
        focus: focus.current,
        selected: picked.current,
        mouse,
        mouseAge: pointer && follow.current ? now - pointer.at : Infinity,
        now: Date.now(),
        still,
        idle: wander.current,
      })
      s = out.state
      paint.current(out.gaze)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', onMove)
    }
  }, [target])
}
