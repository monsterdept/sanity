import { useEffect, useRef } from 'react'

/**
 * How many share the pane — a DENSITY, not a count, and a deliberately thin one.
 *
 * A fixed seven was right for a 290px side panel and wrong the moment this moved behind
 * the map, which is four times the area: the same number would have read as a swarm
 * crossing the chart, and a swarm is a feature competing with the picture rather than
 * something happening at the edge of it. Per unit area it is now about a ninth as thick,
 * which puts two or three on a typical window.
 *
 * Clamped at both ends. One is the floor because zero is not "sparse", it is a missing
 * feature that reads as a bug; the ceiling stops a very large display from turning the
 * thinness back into an infestation.
 */
const AREA_PER_ANT = 500_000
const MIN_ANTS = 1
const MAX_ANTS = 3

const wanted = (w: number, h: number) =>
  Math.max(MIN_ANTS, Math.min(MAX_ANTS, Math.floor((w * h) / AREA_PER_ANT)))

/** Body length in CSS pixels, nose to tail. */
const SIZE = 15

/** Coats, as permutations of the app's OWN palette rather than the mascot pastels.
 *
 *  Written as token names and resolved at runtime, so they are literally the colours the
 *  rest of the window uses and they follow the theme without a second definition to keep
 *  in step. Only these four are read: they are plain hex in both themes, where several
 *  other tokens are `color-mix()` expressions — `getComputedStyle` returns a custom
 *  property AS AUTHORED, so a mixed one would arrive as a string canvas cannot parse.
 *
 *  Deliberately NOT the heat ramp. Hue is the reading everywhere else in this app;
 *  borrowing it for decoration would put the one thing the map means on something that
 *  means nothing.
 *
 *  Three per ant — head, thorax, gaster — because with no outlines the joins are the only
 *  thing separating the segments. */
const COATS: Array<[string, string, string]> = [
  ['--accent-dim', '--accent', '--accent-tint'],
  ['--agent-mark', '--accent', '--accent-tint'],
  ['--accent', '--agent-mark', '--accent-tint'],
  ['--accent-dim', '--agent-mark', '--accent'],
  ['--agent-mark', '--accent-dim', '--accent'],
  ['--accent', '--accent-dim', '--accent-tint'],
]

const resolveCoats = (el: HTMLElement): string[][] => {
  const cs = getComputedStyle(el)
  return COATS.map((c) => c.map((v) => cs.getPropertyValue(v).trim() || '#888'))
}

/** Ink for the LIMBS — the bodies carry no outline at all.
 *
 *  It follows the theme rather than the mascot bundle, which draws in near-black: right
 *  on the light cards it was made for, invisible on this pane in dark mode, where the
 *  pastel bodies carried and the legs and antennae simply weren't there. The brand
 *  already has the rule — marks are ink or white depending on the ground — so this reads
 *  `--foreground`, which is Ink on paper and Paper on ink. */
const inkOf = (el: HTMLElement) => getComputedStyle(el).color

/**
 * Party ants, walking under the map.
 *
 * They started in the empty detail pane, where they were the whole content of a panel
 * that had nothing to say. That panel now carries the project summary, and an idle
 * animation competing with a list of things to do is worse than no animation — so they
 * moved to the one surface that is genuinely mostly empty: the ground behind the rings.
 * Underneath, not over: the sunburst draws on top and an ant passes behind a wedge, which
 * is what keeps this ambient rather than an overlay on the picture.
 *
 * Drawn in the mascots' idiom — flat pastel fills, no outline on the body, everything
 * rounded. Not an illustration of an ant; a mascot that happens to be one.
 *
 * The gait is the tell. Roaches lived here first, and a roach is freeze-and-bolt: long
 * stillness, sudden dash. An ant is the opposite — almost always moving, at a fairly
 * even trot, but never in a straight line for long. So these keep going and turn
 * constantly, and the rare stop is a beat rather than the default state.
 *
 * Canvas rather than DOM: seven sprites with six animated legs each is forty-two moving
 * parts, and doing that with elements makes the compositor re-lay-out a panel whose
 * whole job is to be doing nothing.
 */
export function PartyAnts() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // Some people get motion sick, and some people just don't want bugs on the screen.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Re-read on theme change. Sampling once at mount left every ant outlined for
    // whichever theme happened to be up when the pane first rendered, and the toggle is
    // one click away.
    let ink = inkOf(canvas)
    let coats = resolveCoats(canvas)
    const theme = new MutationObserver(() => {
      ink = inkOf(canvas)
      coats = resolveCoats(canvas)
    })
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    // Deterministic, so the same pane looks the same twice and this is debuggable.
    let seed = 0x9e3779b9
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }

    type Ant = {
      x: number
      y: number
      /** Radians, screen coords, so +y is down. */
      dir: number
      speed: number
      cruise: number
      /** Seconds until the next pause or resume. */
      timer: number
      resting: boolean
      /** Gait cycle. Advances with DISTANCE travelled, not with time, so the stride
       *  stays the same length whatever the speed and a slow ant takes slow steps
       *  rather than mincing. */
      phase: number
      /** Where each foot is planted, in WORLD coordinates.
       *
       *  This is what makes it a walk. Drawn from a fixed offset in the ant's own frame,
       *  a foot travels with the body and the animal skates — legs waving over ground
       *  that slides past underneath. A planted foot stays where it is while the body
       *  moves over it, and only catches up when the leg lifts. Six entries, front to
       *  back, left side then right. */
      feet: Array<{ x: number; y: number }>
      /** Slow wander of the heading, so turns curve instead of jittering. */
      drift: number
      /** Index into the resolved coats, so a theme change repaints without reassigning. */
      coat: number
      scale: number
    }

    let w = 0
    let h = 0
    const ants: Ant[] = []

    const resize = () => {
      const r = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      w = r.width
      h = r.height
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (w <= 0 || h <= 0) return
      // Population tracks the pane, because the count is a density now and the pane
      // resizes — with the window, and every time the sidebar or the detail panel
      // changes what is left for the map. Existing ants are left alone: re-seeding on
      // every resize would teleport the ones already walking, which is the one thing
      // the edge-bounce exists to avoid.
      const n = wanted(w, h)
      while (ants.length > n) ants.pop()
      while (ants.length < n) {
        const cruise = 26 + rand() * 34
        ants.push({
          x: rand() * w,
          y: rand() * h,
          dir: rand() * Math.PI * 2,
          speed: cruise,
          cruise,
          timer: 1 + rand() * 5,
          resting: false,
          phase: rand() * Math.PI * 2,
          // Planted on the first frame, once the ant has a position to plant around.
          feet: [],
          drift: rand() * Math.PI * 2,
          coat: Math.floor(rand() * COATS.length) % COATS.length,
          scale: 0.8 + rand() * 0.45,
        })
      }
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    /** Where leg `i` would like its foot, in the ant's own frame. */
    const stance = (L: number, i: number): [number, number] => {
      const side = i < 3 ? -1 : 1
      const k = i % 3
      const along = [0.3, 0.02, -0.28][k]
      return [L * (0.08 - k * 0.15) + L * along, side * L * 0.34]
    }

    /**
     * Advance the gait and plant the feet.
     *
     * Alternating tripod: legs 1-3-5 swing while 2-4-6 hold, which is how every
     * six-legged animal walks and why an ant never looks unstable. A leg in STANCE is
     * simply left alone — the body moving over a stationary foot is the whole effect.
     */
    const step = (a: Ant, dt: number) => {
      const L = SIZE * a.scale
      const cos = Math.cos(a.dir)
      const sin = Math.sin(a.dir)
      for (let i = 0; i < 6; i++) {
        const [lx, ly] = stance(L, i)
        const tx = a.x + lx * cos - ly * sin
        const ty = a.y + lx * sin + ly * cos
        if (!a.feet[i]) {
          a.feet[i] = { x: tx, y: ty }
          continue
        }
        const foot = a.feet[i]
        // Tripod groups are offset by half a cycle.
        const group = (i % 3) + (i < 3 ? 0 : 1)
        const swinging = Math.sin(a.phase + (group % 2) * Math.PI) > 0
        const dx = tx - foot.x
        const dy = ty - foot.y
        // A foot dragged too far behind takes a step regardless of phase. Without this,
        // a sharp turn or an edge bounce leaves a leg stretched across the pane until
        // its next swing comes round.
        const strained = dx * dx + dy * dy > (L * 0.9) ** 2
        if (swinging || strained) {
          const k = Math.min(1, dt * 18)
          foot.x += dx * k
          foot.y += dy * k
        }
      }
    }

    const draw = (a: Ant) => {
      const L = SIZE * a.scale
      ctx.save()
      ctx.translate(a.x, a.y)
      ctx.rotate(a.dir)
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.strokeStyle = ink
      // Held well back. At full strength on the dark pane the limbs were the brightest
      // thing on the ant — a white cage with a pastel body inside it, when the body is
      // supposed to be the animal and the legs are supposed to be how it gets about.
      ctx.globalAlpha = 0.45

      // Legs first, so the body sits over the joints.
      //
      // CURVED and short. They were straight two-segment struts reaching most of a body
      // length out, which read as a spider or a splat — a real leg bends at the knee and
      // the foot turns back under the animal, and it does not extend much past the body.
      // A quadratic through a knee gives the bend for one curve per leg; the control
      // point IS the knee, pushed out and forward of the line from hip to foot.
      //
      // Alternating tripod: one side leads while the other trails, which is how a
      // six-legged animal actually walks and is what makes it read as purposeful.
      ctx.lineWidth = Math.max(0.9, L * 0.055)
      // The canvas is already translated and rotated into the ant's frame, so a world
      // foot has to come back the other way to be drawn.
      const cos = Math.cos(-a.dir)
      const sin = Math.sin(-a.dir)
      for (let i = 0; i < 6; i++) {
        const foot = a.feet[i]
        if (!foot) continue
        const side = i < 3 ? -1 : 1
        const k = i % 3
        const wx = foot.x - a.x
        const wy = foot.y - a.y
        const fx = wx * cos - wy * sin
        const fy = wx * sin + wy * cos
        const hx = L * (0.08 - k * 0.15)
        const hy = side * L * 0.1
        // Knee: pushed out past the foot, which bows the curve outward and tucks the
        // foot back under the body the way a real leg folds.
        const kx = (hx + fx) / 2
        const ky = (hy + fy) / 2 + side * L * 0.2
        ctx.beginPath()
        ctx.moveTo(hx, hy)
        ctx.quadraticCurveTo(kx, ky, fx, fy)
        ctx.stroke()
      }

      // Elbowed antennae — the bend is what separates an ant from everything else with
      // six legs, and at this size it is most of the read.
      ctx.lineWidth = Math.max(0.7, L * 0.045)
      for (const side of [-1, 1]) {
        const wave = Math.sin(a.phase * 0.8 + side * 1.2) * 0.09
        // Curved too, and shorter — the elbow is a bend, not a corner.
        ctx.beginPath()
        ctx.moveTo(L * 0.34, side * L * 0.06)
        ctx.quadraticCurveTo(
          L * 0.52,
          side * (L * 0.08 + wave * L),
          L * 0.5,
          side * (L * 0.26 + wave * L),
        )
        ctx.stroke()
      }

      // Bodies at full strength — only the limbs are held back.
      ctx.globalAlpha = 1

      // Three segments, back to front. An ant is a gaster, a waist and a head — draw it
      // as one oval and it is a beetle.
      //
      // No outline on the bodies: the mascots have none, and a stroke here also drew a
      // seam down every join. The segments OVERLAP instead, which is what makes them
      // read as one animal rather than three beads on a string — each is wide enough to
      // bite into its neighbour, so the silhouette closes without a line to close it.
      const seg = (cx: number, rx: number, ry: number, fill: string) => {
        ctx.beginPath()
        ctx.ellipse(cx, 0, rx, ry, 0, 0, Math.PI * 2)
        ctx.fillStyle = fill
        ctx.fill()
      }
      const coat = coats[a.coat]
      seg(-L * 0.28, L * 0.27, L * 0.22, coat[2]) // gaster
      seg(-L * 0.04, L * 0.17, L * 0.15, coat[1]) // thorax, biting into both
      seg(L * 0.22, L * 0.19, L * 0.17, coat[0]) // head

      // One highlight on the gaster. The mascots all carry a light spot like this and it
      // is what stops a flat fill from reading as a sticker.
      ctx.beginPath()
      ctx.ellipse(-L * 0.36, -L * 0.06, L * 0.07, L * 0.05, -0.5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.globalAlpha = 0.5
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.restore()
    }

    let raf = 0
    let last = 0
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      // Guards the first frame and any tab-restore, where the delta is however long the
      // tab was hidden and every ant would teleport.
      const dt = last ? Math.min((t - last) / 1000, 0.05) : 0
      last = t
      ctx.clearRect(0, 0, w, h)

      for (const a of ants) {
        a.timer -= dt
        if (a.timer <= 0) {
          a.resting = !a.resting
          // Pauses are short and rare; the default state is moving. Invert those and it
          // stops being an ant.
          a.timer = a.resting ? 0.2 + rand() * 0.7 : 2 + rand() * 6
        }
        // Eased rather than switched, so a stop is a stop and not a freeze-frame.
        const want = a.resting ? 0 : a.cruise
        a.speed += (want - a.speed) * Math.min(1, dt * 6)

        a.drift += dt
        // Two turns at once: a slow sine that curves the path and a small jitter. Either
        // alone reads mechanically — the sine is a lazy circle, the jitter is a drunk
        // straight line. Together it looks like something with somewhere to be.
        a.dir += Math.sin(a.drift * 1.3) * 1.1 * dt + (rand() - 0.5) * 3 * dt
        a.x += Math.cos(a.dir) * a.speed * dt
        a.y += Math.sin(a.dir) * a.speed * dt
        // Per unit DISTANCE, so stride length is fixed and speed changes cadence.
        a.phase += a.speed * dt * 0.35
        step(a, dt)

        // Turn at the edges rather than wrapping: something reappearing on the far side
        // reads as a rendering bug, not as an animal that reached a wall.
        const m = SIZE * 0.6
        if (a.x < m || a.x > w - m) {
          a.dir = Math.PI - a.dir
          a.x = Math.min(Math.max(a.x, m), w - m)
        }
        if (a.y < m || a.y > h - m) {
          a.dir = -a.dir
          a.y = Math.min(Math.max(a.y, m), h - m)
        }
        draw(a)
      }
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      theme.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden
      // Held further back than it was in the side panel. There it was the only thing in
      // the pane and could carry; here it shares a surface with the one picture this app
      // exists to draw, and anything on that surface that is not the reading has to stay
      // clearly under it.
      className="pointer-events-none absolute inset-0 z-0 h-full w-full text-[var(--foreground)] opacity-40"
    />
  )
}
