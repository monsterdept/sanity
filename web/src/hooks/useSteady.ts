import { useRef } from 'react'
import type { Node } from '../lib/api'

/** Hold on to the value that was here before, when the new one says the same thing.
 *
 *  **A memo keyed on the tree recomputes whenever any wedge in the repo moves**, and hands
 *  back a fresh object even where its own answer is unchanged — which is how a reading
 *  landing in `src/parse.rs` re-renders a panel that is showing a function in `web/`. The
 *  comparison is per value and cheap; what it buys is the difference between a window that
 *  updates what changed and one that redraws itself around it.
 *
 *  Written during render rather than in an effect, on the same argument every other
 *  comparison in this file makes: the point is for the consumer never to SEE the new object,
 *  and an effect runs a render too late. */
export function useSteady<T>(next: T, same: (was: T, now: T) => boolean): T {
  const held = useRef(next)
  if (held.current !== next && !same(held.current, next)) held.current = next
  return held.current
}

/** Two rankings that spend the colours the same way. Small by construction — a lens spends
 *  at most `CAPS` of them — so this is a comparison nobody has to think about the cost of. */
export function sameRanks(
  a: Map<string, number> | undefined,
  b: Map<string, number> | undefined,
): boolean {
  if (!a || !b) return a === b
  if (a.size !== b.size) return false
  for (const [k, v] of a) if (b.get(k) !== v) return false
  return true
}

/** The same containers, in the same order. */
export function sameNodes(a: readonly Node[], b: readonly Node[]): boolean {
  return a.length === b.length && a.every((n, i) => n === b[i])
}
