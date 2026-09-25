import { type Node } from './api'
import { type Wedge } from './sunburst'

/** A direction from the hub, x right and **y up** — the world's way, not the screen's. */
export type Bearing = { x: number; y: number }

/** How many lit wedges the dot will look at one at a time before giving up and taking
 *  them as a region — see `gaze`. Small, because this is the number of things a glance can
 *  distinguish, not a display limit. */
const GAZE_INDIVIDUALS = 6

/** Where the hub is looking: at whatever is happening right now.
 *
 *  **Two sources, one answer, because there are two ways this map moves on its own.** A
 *  scan lights the wedge it is reading (`reading`); a replay flashes the wedge the commit
 *  under the playhead touched (`appeared`/`edited`, see `inStep` in `history.ts`). They
 *  never overlap — one is the repo being measured, the other the repo being remembered —
 *  and both are "the action", so both aim the eyes. Anywhere else there is no action, the
 *  answer is null, and the eyes go back to following the pointer, which is the right
 *  behaviour for a map that is only moving because somebody is moving it.
 *
 *  **The mean direction, not one of them.** A scan touches a dozen wedges at once,
 *  scattered around the ring, and a commit touches a directory's worth — so picking one
 *  would twitch between neighbours several times a second. The mean points at the part of
 *  the ring the work is in, and swings across when the work moves rather than jumping.
 *
 *  `a` is clockwise from 12 o'clock, and a bearing has **y up** where the
 *  screen has y down, so the vertical component is NOT negated the way it would be for an
 *  SVG coordinate; `useHubGaze` turns it to the screen's way, once.
 *
 *  Rounded, so a set that gains and loses one thin wedge does not re-aim on every tick —
 *  finely enough that the motion reads as a turn rather than a series of steps, which is
 *  what the bundle's own smoothing is then free to make continuous. It recomputes as fast
 *  as its inputs move: every replay frame, and every flush of the scan's lit set.
 */
export function gazeOf(wedges: readonly Wedge[], pulsing: ReadonlySet<string> | undefined): Bearing[] | null {
  // Aimed at the same wedges that flash, so the eyes can be checked against the picture.
  const at: Array<{ x: number; y: number }> = []
  for (const w of wedges) {
    const s = w.node.score
    if (!pulsing?.has(w.node.id) && s?.appeared !== 1 && s?.edited !== 1) continue
    const mid = (w.a0 + w.a1) / 2
    const r = (n: number) => Math.round(n * 50) / 50
    at.push({ x: r(Math.sin(mid)), y: r(Math.cos(mid)) })
  }
  if (at.length === 0) return null
  // **A few things are looked at in turn; a crowd is looked at as a place.** Blame does
  // not run at a constant rate — it comes in bursts and then labours over three or four
  // files for seconds at a time — and through those lulls a single averaged bearing is a
  // stare into the middle distance. Handing the gaze the individual wedges
  // lets it glance between them, which is what something watching actually does.
  //
  // Past a handful there is nothing to glance between: twenty wedges cycled one at a time
  // is a twitch, and their mean is a real answer — the region the work is in. So the
  // crowd collapses to one bearing and the eyes settle on it.
  if (at.length <= GAZE_INDIVIDUALS) return at
  let x = 0
  let y = 0
  for (const d of at) {
    x += d.x
    y += d.y
  }
  const len = Math.hypot(x, y)
  // Wedges spread evenly around the ring cancel out, and a zero vector is a direction
  // nobody can face. Looking straight ahead is the honest answer to "everywhere at once".
  if (len < 1e-3) return null
  return [{ x: Math.round((x / len) * 50) / 50, y: Math.round((y / len) * 50) / 50 }]
}

/** Which way the clicked wedge is from the hub, for the circles' dot to look at — y up, like
 *  `gaze`. When the wedge itself is not drawn, the nearest drawn wedge that holds it, which
 *  is where it is on screen. Null for the level itself, which is all around the hub. */
export function bearingOf(
  selected: Node | null,
  wedges: readonly Wedge[],
  rootId: string,
): Bearing | null {
  if (!selected || selected.id === rootId) return null
  let best: Wedge | null = null
  for (const w of wedges) {
    if (w.node.id === rootId) continue
    if (w.node.id === selected.id) {
      best = w
      break
    }
    const holds = w.node.path === selected.path || selected.path.startsWith(`${w.node.path}/`)
    if (holds && w.node.kind !== 'func' && (!best || w.node.path.length > best.node.path.length)) best = w
  }
  if (!best) return null
  const mid = (best.a0 + best.a1) / 2
  return { x: Math.sin(mid), y: Math.cos(mid) }
}
