import { useEffect, useRef } from 'react'

/**
 * A watch's balance wheel and the escape wheel round it, for the hub — one of the things
 * `lib/hub.ts` lets the middle hold.
 *
 * **The balance is simulated, not animated, because the motion is the whole of the point.** Two
 * curves were tried and both read wrong. A sine looked like a wheel that reached each end and
 * parked. A triangle bent toward a sine looked like it bounced off a wall. A balance does
 * neither. The hairspring pulls it back harder the further it goes, so it slows and slows, comes
 * to a stop, and is thrown back the other way. Friction takes a little of every swing. The
 * escapement gives it back with a kick as the wheel passes through the middle. So this is that:
 * a damped spring (`stepBalance`) with an impulse inside `KICK` of centre. The amplitude holds
 * itself steady, since a swing that comes back short meets a kick that makes up the difference.
 *
 * **The escape wheel only ever goes one way, and only when the balance lets it.** It is the gear
 * round the outside. It is locked while the balance swings free, and it moves one tooth each time
 * the balance passes through the kick, whichever way the balance is going. Its angle is read off
 * the balance's own (`escapeAngle`), not given a clock of its own. A gear with a separate clock
 * would drift out of step with the swing it is meant to be counting.
 *
 * The hairspring is the other half of the balance's look. Its inner end is pinned to the collet
 * on the staff and its outer end to the stud, so the coils wind tight as the wheel goes one way
 * and open out as it comes back.
 *
 * Drawn in SVG inside the map, not laid over it like the creature, so a report or a movie that
 * copies the map carries it with no special case. It is moved by writing attributes a frame,
 * never by rendering: a React render per frame would re-run the hub for a picture only these
 * groups changed. A movie re-rasterizes the map once per commit, so there it moves commit to
 * commit rather than frame to frame.
 *
 * Held still under reduced motion, at rest.
 */

/** How far it swings each way, in degrees. Real balances run 250–300°; less reads as a wobble. */
const AMPLITUDE = 260
/** The damping ratio: how much of each swing friction takes. A real balance loses far less, and
 *  at that rate the loss cannot be seen, which is the one part of the motion that was asked for. */
const DAMPING = 0.06
/** How far either side of centre the escapement pushes, in degrees. It is also where the escape
 *  wheel moves: the push and the tooth are the same event. */
const KICK = 25
/** How hard it pushes toward the speed a full swing needs, per swing. Strong enough to make up
 *  the loss inside the window, gentle enough to be a surge rather than a jolt. */
const KICK_RATE = 120
/** The step the spring is integrated at, in swings. Each frame is cut into steps this small so
 *  a fast wheel on a slow frame is still a spring and not a guess. */
const STEP = 0.002
/** The balance's size, as a share of the disc. Filling the disc made an ornament of what should
 *  sit in the middle of the map. The escape wheel now takes the ring outside it, so the pair
 *  together take about the room the balance alone once did. */
const SIZE = 0.5
/** The escape wheel, in shares of the disc: the hole the balance sits in, the tooth roots, and
 *  the tooth tips. Both ends were tried. A thick band with tall sawteeth looked like a cartoon
 *  cog. A hairline rim with thin teeth looked like lines round a circle, not a part. The rim
 *  has body, and the teeth are short. */
const GEAR = { hole: 0.475, root: 0.51, tip: 0.575 }
/** Teeth on the escape wheel. One tooth goes by per half swing. */
const TEETH = 30
/** Coils in the hairspring. Few enough that they stay apart at the hub's size. */
const TURNS = 4
/** How hard winding pulls the coils in toward the staff, at full swing. */
const BREATH = 0.8
/** The screws round the rim. */
const SCREWS = 16
/** The ink. The muted one, not the foreground: in full black the wheel was the darkest thing on
 *  the map, and the middle is where every wedge points, not where the eye should stop. */
const INK = 'var(--muted-foreground)'
/** The three parts are three greys: one ink at three strengths, so they follow the theme
 *  together. The spring is the strongest because its lines are the finest. The collet and stud
 *  it is pinned between take its grey. The escape wheel is the faintest, because the balance is
 *  what is alive and the escape wheel only counts it. A blued-steel spring was tried and read as
 *  a fourth thing. */
const GREY = { spring: 0.9, balance: 0.55, escape: 0.3 }

/** Where the balance is and how fast it is going: degrees, and degrees per swing. Time here is
 *  counted in swings, not seconds, which is what lets the speed control change under a running
 *  wheel: the caller turns seconds into swings, and the spring never knows.
 *
 *  The last two fields are the escapement. `ticks` is the number of teeth that have gone by.
 *  `dir` is the way the balance entered the kick it is inside, or 0 when it is outside one. */
export interface Balance {
  deg: number
  vel: number
  ticks: number
  dir: -1 | 0 | 1
}

const OMEGA = 2 * Math.PI
/** The speed through centre that carries a damped wheel out to `AMPLITUDE`: an undamped one
 *  needs ωA, and damping over the quarter swing out takes about `e^(-ζπ/2)` of it. */
const CENTRE_SPEED = OMEGA * AMPLITUDE * Math.exp((DAMPING * Math.PI) / 2)

/** A wheel at rest in the middle, just kicked, halfway through its first tooth. */
export function startBalance(): Balance {
  return { deg: 0, vel: CENTRE_SPEED, ticks: 0, dir: 1 }
}

/** Advance the wheel `swings` swings: θ'' = −ω²θ − 2ζωθ′, plus the escapement's push inside
 *  `KICK` of centre. Semi-implicit Euler, which keeps a spring's energy where explicit Euler
 *  lets it grow. */
export function stepBalance(b: Balance, swings: number): Balance {
  const n = Math.max(1, Math.ceil(swings / STEP))
  const h = swings / n
  let { deg, vel, ticks, dir } = b
  for (let i = 0; i < n; i++) {
    vel += (-OMEGA * OMEGA * deg - 2 * DAMPING * OMEGA * vel) * h
    const inside = Math.abs(deg) < KICK
    if (inside) {
      if (dir === 0) dir = vel < 0 ? -1 : 1
      const target = (vel < 0 ? -1 : 1) * CENTRE_SPEED
      vel += (target - vel) * (1 - Math.exp(-h * KICK_RATE))
    } else if (dir !== 0) {
      // Out of the kick: the tooth has gone by and the escape wheel locks again.
      ticks += 1
      dir = 0
    }
    deg += vel * h
  }
  return { deg, vel, ticks, dir }
}

/** The escape wheel's angle, in degrees, always increasing. Locked between kicks. Through a kick
 *  it turns one tooth in step with the balance crossing the window, as a lever drives it,
 *  whichever way the balance is going. */
export function escapeAngle(b: Balance): number {
  const through = b.dir === 0 ? 0 : Math.min(1, Math.max(0, (b.deg * b.dir + KICK) / (2 * KICK)))
  return ((b.ticks + through) * 360) / TEETH
}

/** The escape wheel's outline: a rim with a hole for the balance, and club teeth cut from it.
 *
 *  **A tooth has to look like metal, not like a stroke.** Leaning stems, however they were
 *  angled, read as hatching or as lines. So each tooth has the profile of a real Swiss lever
 *  escape tooth. It stands on a broad foot, about half the tooth spacing. Its back rises in a
 *  concave curve to a flat club head. Its front face drops steeply to the rim. The club leads,
 *  so the one way the wheel turns shows even while it is locked. */
function escapeWheel(r: number): string {
  const pt = (rho: number, a: number) =>
    `${(rho * r * Math.cos(a)).toFixed(2)} ${(rho * r * Math.sin(a)).toFixed(2)}`
  const step = (2 * Math.PI) / TEETH
  // The curve's control point sits low and late, which hollows the back of the tooth.
  const hollow = GEAR.root + (GEAR.tip - GEAR.root) * 0.25
  let d = ''
  for (let i = 0; i < TEETH; i++) {
    const a = i * step
    d += `${i === 0 ? 'M' : 'L'}${pt(GEAR.root, a)}`
    // Up the hollow back, across the club head, down the front face, along the rim to the next.
    d += `Q${pt(hollow, a + 0.38 * step)} ${pt(GEAR.tip, a + 0.48 * step)}`
    d += `L${pt(GEAR.tip, a + 0.72 * step)}L${pt(GEAR.root, a + 0.62 * step)}`
    d += `L${pt(GEAR.root, a + step)}`
  }
  d += 'Z'
  const hole = GEAR.hole * r
  d += `M${hole.toFixed(2)} 0A${hole.toFixed(2)} ${hole.toFixed(2)} 0 1 0 ${(-hole).toFixed(2)} 0`
  d += `A${hole.toFixed(2)} ${hole.toFixed(2)} 0 1 0 ${hole.toFixed(2)} 0Z`
  return d
}

/** The hairspring at a given wheel angle, for a disc of radius `r`. Its inner end turns with
 *  the wheel, its outer end is fixed, and everything between shares the angle out in
 *  proportion.
 *
 *  **Sharing the angle out is not enough to see.** Turning an even spiral re-phases it and it
 *  looks the same at every angle, which the first drawing proved. A wound spring closes its
 *  coils in toward the staff and an unwound one opens them out against the stud, so the coils'
 *  spacing is bent by the swing too: `s^p`, with `p` above one wound and below it unwound. */
export function hairspring(r: number, deg: number): string {
  const inner = 0.1 * SIZE * r
  const outer = 0.44 * SIZE * r
  const turn = (deg * Math.PI) / 180
  const p = Math.exp((BREATH * deg) / AMPLITUDE)
  // Outer end at the top right, where the stud sits.
  const end = -Math.PI / 4
  const steps = TURNS * 36
  let d = ''
  for (let i = 0; i <= steps; i++) {
    const s = i / steps
    const rho = inner + (outer - inner) * Math.pow(s, p)
    const phi = end - TURNS * 2 * Math.PI * (1 - s) + turn * (1 - s)
    d += `${i === 0 ? 'M' : 'L'}${(rho * Math.cos(phi)).toFixed(2)} ${(rho * Math.sin(phi)).toFixed(2)}`
  }
  return d
}

export function BalanceWheel({ r, hz }: { r: number; /** Full swings a second. */ hz: number }) {
  const wheel = useRef<SVGGElement>(null)
  const spring = useRef<SVGPathElement>(null)
  const gear = useRef<SVGPathElement>(null)
  // Read by the running loop rather than restarting it, so a new speed carries on from where
  // the wheel is instead of starting it over.
  const speed = useRef(hz)
  useEffect(() => {
    speed.current = hz
  }, [hz])

  useEffect(() => {
    const draw = (b: Balance) => {
      wheel.current?.setAttribute('transform', `rotate(${b.deg.toFixed(2)})`)
      spring.current?.setAttribute('d', hairspring(r, b.deg))
      gear.current?.setAttribute('transform', `rotate(${escapeAngle(b).toFixed(2)})`)
    }
    let b = startBalance()
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(b)
      return
    }
    // A frame's step is capped so a window coming back from hidden resumes the swing rather
    // than integrating the whole time it was away.
    let last = performance.now()
    let raf = 0
    const step = (now: number) => {
      b = stepBalance(b, Math.min(0.1, (now - last) / 1000) * speed.current)
      last = now
      draw(b)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [r])

  // Everything in the balance is in `u`, the balance's own radius unit.
  const u = SIZE * r
  const rim = 0.72 * u
  const studAt = { x: 0.44 * u * Math.cos(-Math.PI / 4), y: 0.44 * u * Math.sin(-Math.PI / 4) }
  return (
    <g className="pointer-events-none">
      <g ref={wheel}>
        <circle r={rim} fill="none" stroke={INK} strokeOpacity={GREY.balance} strokeWidth={0.08 * u} />
        {Array.from({ length: SCREWS }, (_, i) => {
          const a = (i / SCREWS) * 2 * Math.PI
          return (
            <circle
              key={i}
              cx={0.79 * u * Math.cos(a)}
              cy={0.79 * u * Math.sin(a)}
              r={0.035 * u}
              fill={INK}
              fillOpacity={GREY.balance}
            />
          )
        })}
        {/* Three arms, the commonest balance there is. */}
        {[0, 120, 240].map((a) => (
          <rect
            key={a}
            x={-0.02 * u}
            y={-rim}
            width={0.04 * u}
            height={rim}
            fill={INK}
            fillOpacity={GREY.balance}
            transform={`rotate(${a})`}
          />
        ))}
        {/* The roller and its impulse jewel: the one ruby on the wheel, and the part that makes
            the swing legible when the arms are a blur. */}
        <circle r={0.2 * u} fill="var(--card)" stroke={INK} strokeOpacity={GREY.balance} strokeWidth={0.03 * u} />
        <circle cy={-0.15 * u} r={0.035 * u} fill="#b0233a" fillOpacity={0.75} />
      </g>
      <path
        ref={spring}
        d={hairspring(r, 0)}
        fill="none"
        stroke={INK}
        strokeOpacity={GREY.spring}
        strokeWidth={Math.max(0.5, 0.015 * u)}
      />
      {/* The collet, which the spring's inner end is pinned to, and the staff through it. Its
          edge is exactly where `hairspring` starts: a staff dot smaller than that left the
          spring ending in the air, fixed at the stud and attached to nothing at the other end. */}
      <circle r={0.1 * u} fill="var(--card)" stroke={INK} strokeOpacity={GREY.spring} strokeWidth={0.03 * u} />
      <circle r={0.04 * u} fill={INK} fillOpacity={GREY.balance} />
      <rect
        x={studAt.x - 0.035 * u}
        y={studAt.y - 0.035 * u}
        width={0.07 * u}
        height={0.07 * u}
        fill={INK}
        fillOpacity={GREY.spring}
      />
      {/* The escape wheel, lighter than the balance: the balance is what is alive, and this is
          what it is counting. */}
      <path
        ref={gear}
        d={escapeWheel(r)}
        fillRule="evenodd"
        fill={INK}
        fillOpacity={GREY.escape}
        transform={`rotate(${escapeAngle(startBalance()).toFixed(2)})`}
      />
    </g>
  )
}
