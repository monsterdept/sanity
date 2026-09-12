import { useEffect, useId, useRef } from 'react'
import { startGaze, stepGaze, type Look } from '../lib/eyeGaze'

/**
 * An eye for the hub, one of the things `lib/hub.ts` lets the middle hold. It looks where the
 * monster would look and blinks when the monster would blink. `lib/eyeGaze.ts` has the rules,
 * copied from the creature's engine.
 *
 * **Drawn as a flat graphic eye, not an anatomical one**, after the "evil eye" marks. It has no
 * outline and no lashes. There are two almonds that share their points: an outer one, the lid,
 * and a paler inner one, the opening. The iris is large and clipped by the opening: a light ring,
 * the iris, the pupil, and a catchlight. It is in greys, as the wheel is, but in fixed tones:
 * see `TONE`.
 *
 * Drawn in SVG inside the map, like the balance wheel, so a report or a movie that copies the map
 * carries it. It is moved by writing attributes a frame, never by rendering.
 *
 * **The lids close from the top, as a lid does.** The upper lid comes most of the way down and
 * the lower one rises to meet it just below centre. An almond that shrank to its middle line read
 * as a squint, not a blink.
 */

/** In shares of the disc, in the reference's proportions. The two almonds share their points.
 *  The rings go from the outside in. The catchlight sits up and to the right. `travel` is how
 *  far the iris can move each way: less vertically, because the lids are closer.
 *
 *  As wide as the disc allows without reaching its rim. The findings badges sit above and below
 *  the eye, not beside it. At half the disc's width, the first size tried, the eye was a small
 *  glyph with empty dark either side, and the catchlight was too small to see. */
export const EYE = {
  outer: { w: 0.72, h: 0.42 },
  inner: { w: 0.72, h: 0.31 },
  ring: 0.27,
  iris: 0.19,
  pupil: 0.1,
  // Out toward the iris's edge. Near the pupil's centre, it read as a dot painted on the pupil,
  // not a light caught on the curve of the eye.
  glint: { x: 0.11, y: -0.1, r: 0.04 },
  travelX: 0.26,
  travelY: 0.04,
}
/** The greys, as fixed tones rather than the theme's ink at strengths, which is how the wheel
 *  does it. **An eye cannot be drawn in negative.** Theme ink lightens on the dark card, so the
 *  pupil came out pale and the white of the eye dark. That is a blind eye, not the same eye in
 *  another light. These run from light to near-black, and sit on either card and on the
 *  report's white paper.
 *
 *  **Neutral, and nothing near white but the catchlight.** Warm greys read as beige against the
 *  plum theme. A near-white ring was the brightest thing in the window, brighter than the
 *  findings count above it, which is what the hub is there to point at. The catchlight stays
 *  the brightest spot, because it is small and it is what makes the eye look wet. */
const TONE = {
  lid: '#7e7f82',
  opening: '#a9aaad',
  ring: '#cfd0d3',
  iris: '#6c6d71',
  pupil: '#27282b',
  glint: '#e4e5e8',
}
/** How often the eye's position on screen is measured again for the pointer. It moves only when
 *  the window does, and measuring every frame would lay out the whole map every frame. */
const MEASURE_MS = 500

const f = (n: number) => n.toFixed(2)

/** An almond for how far closed it is: two quadratic curves between its points. A quadratic's
 *  peak is half its control point's height, hence the doubling. */
export function almond(r: number, size: { w: number; h: number }, closed: number): string {
  const w = size.w * r
  const h = size.h * r
  const top = -h + closed * 1.15 * h
  const bottom = h - closed * 0.85 * h
  return `M${f(-w)} 0Q0 ${f(2 * top)} ${f(w)} 0Q0 ${f(2 * bottom)} ${f(-w)} 0Z`
}

export function HubEye({
  r,
  gaze,
}: {
  r: number
  /** The creature's gaze targets, x right and **y up** — see `gaze` in `Sunburst` — or null. */
  gaze: Array<{ x: number; y: number }> | null
}) {
  const clip = `hub-eye-${useId().replace(/[^\w-]/g, '')}`
  const eye = useRef<SVGGElement>(null)
  const lid = useRef<SVGPathElement>(null)
  const opening = useRef<SVGPathElement>(null)
  const openingClip = useRef<SVGPathElement>(null)
  const ball = useRef<SVGGElement>(null)

  // Read by the running loop rather than restarting it. Turned to the screen's y down here, once.
  const focus = useRef<Look[] | null>(null)
  useEffect(() => {
    focus.current = gaze && gaze.length > 0 ? gaze.map((d) => ({ x: d.x, y: -d.y })) : null
  }, [gaze])

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
      if (pointer) {
        if (now - measured > MEASURE_MS) {
          box = eye.current?.getBoundingClientRect() ?? null
          measured = now
        }
        if (box && box.width > 0) {
          const vx = pointer.x - (box.left + box.width / 2)
          const vy = pointer.y - (box.top + box.height / 2)
          // As the creature does it: the pointer's direction, softened near the eye by a depth
          // the size of the eye, so a pointer right on it looks nearly straight ahead.
          const len = Math.sqrt(vx * vx + vy * vy + box.width * box.width)
          mouse = { x: vx / len, y: vy / len }
        }
      }
      const out = stepGaze(s, dt, {
        focus: focus.current,
        mouse,
        mouseAge: pointer ? now - pointer.at : Infinity,
        now: Date.now(),
        still,
      })
      s = out.state
      const c = out.gaze.closed
      ball.current?.setAttribute(
        'transform',
        `translate(${f(out.gaze.x * EYE.travelX * r)} ${f(out.gaze.y * EYE.travelY * r)})`,
      )
      const i = almond(r, EYE.inner, c)
      lid.current?.setAttribute('d', almond(r, EYE.outer, c) + i)
      opening.current?.setAttribute('d', i)
      openingClip.current?.setAttribute('d', i)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('mousemove', onMove)
    }
  }, [r])

  const i = almond(r, EYE.inner, 0)
  return (
    <g ref={eye} className="pointer-events-none">
      <defs>
        <clipPath id={clip}>
          <path ref={openingClip} d={i} />
        </clipPath>
      </defs>
      {/* The lid is a band: the outer almond with the opening cut out of it. Painting the
          opening over a whole lid added its grey to the lid's, and the opening came out darker
          than the lid it was meant to be paler than. */}
      <path ref={lid} d={almond(r, EYE.outer, 0) + i} fillRule="evenodd" fill={TONE.lid} />
      <path ref={opening} d={i} fill={TONE.opening} />
      <g clipPath={`url(#${clip})`}>
        <g ref={ball}>
          <circle r={EYE.ring * r} fill={TONE.ring} />
          <circle r={EYE.iris * r} fill={TONE.iris} />
          <circle r={EYE.pupil * r} fill={TONE.pupil} />
        </g>
        {/* The catchlight: without it the pupil is a hole, not something that looks. It is a
            reflection of a light that stays where it is, so it stays where it is too, outside
            the moving iris. It is still inside the lids, so a blink covers it. */}
        <circle cx={EYE.glint.x * r} cy={EYE.glint.y * r} r={EYE.glint.r * r} fill={TONE.glint} />
      </g>
    </g>
  )
}
