import type { ChurnWindows, Node } from './api'
import {
  AGE_DEFAULT,
  capRanks,
  CHURN_DEFAULT_WINDOW,
  holdsUncommitted,
  legendFor,
  rankCategories,
  VIEWS_DEFAULT,
  type AgeRead,
  type BlameRead,
  type ColorMode,
  type DerivableRead,
  type TangleRead,
  type Views,
} from './colorMode'
import { lensKey, type LensKey } from './lensKey'
import type { Locked } from './locks'
import { isCapped } from './palette'

/**
 * What a report is made of that is not data: how the lenses are set, how categories are ranked,
 * and what each key says — as functions of the repository, so a report made by the window and one
 * made without it are the same report.
 */

/** The lens readings a session starts in, which a report made without a window is set at. */
export const READINGS_DEFAULT = {
  ageRead: 'newest' as AgeRead,
  blameRead: 'touched' as BlameRead,
  tangleRead: 'weighted' as TangleRead,
  churnAt: CHURN_DEFAULT_WINDOW,
  derivable: 'none' as DerivableRead,
}

export interface ViewFacts {
  /** `ageSpanOf(tree)`, or nothing where there is no tree to measure. */
  ageSpan: number | null | undefined
  /** `ScanStats.churnWindows` and `churned`, where a scan has said. */
  churnWindows?: ChurnWindows
  churned?: boolean
  ageRead: AgeRead
  blameRead: BlameRead
  tangleRead: TangleRead
  churnAt: number
  derivable: DerivableRead
}

/** Both calibrated lenses and every reading as one value — see `Views`. */
export function viewsFor(f: ViewFacts): Views {
  return {
    // `AGE_DEFAULT.span` where there is no tree to measure, not zero: zero is a repo with
    // no span, which `ageRamp` reads as "everything here is younger than a day".
    age: { span: f.ageSpan ?? AGE_DEFAULT.span, read: f.ageRead },
    blame: f.blameRead,
    churn: {
      // The repo's own ladder, or the full one where there is no scan yet — a control has
      // to be able to name its rungs before anything has been walked.
      windows: f.churnWindows ?? VIEWS_DEFAULT.churn.windows,
      // Clamped, because the ladder can be shorter than the index somebody left on it: a
      // young repo's rungs are its own days, and switching projects must not leave the map
      // painted at a rung this one does not have.
      at: Math.min(Math.max(f.churnAt, 0), 3),
      // **The one place the absence lives.** Until the timeline is walked every count is
      // zero, and zero is a finding — see `ChurnView.measured`.
      measured: f.churned ?? false,
    },
    tangle: f.tangleRead,
    derivable: f.derivable,
  }
}

/**
 * Category → color slot for a lens over `at`: authors by the repository's own cast, everything else
 * ranked over the tree, each capped where a cap is set. `App.slotsFor` is the window's twin, which
 * additionally holds languages steady across a replay; a report is never of a replay.
 */
export function slotsFor(authors: readonly string[], caps: Partial<Record<ColorMode, number>> = {}) {
  return (m: ColorMode, at: Node): Map<string, number> => {
    const cap = isCapped(m) ? (caps[m] ?? Infinity) : Infinity
    const ranks = m === 'blame' && authors.length > 0 ? new Map(authors.map((name, i) => [name, i])) : rankCategories(at, m)
    return capRanks(ranks, cap) ?? new Map<string, number>()
  }
}

/** The key a lens's figure prints, over `at`, at the report's own settings. */
export function keyFor(m: ColorMode, at: Node, views: Views, slots: Map<string, number>): LensKey | null {
  return lensKey(m, views, legendFor(at, m, views.blame), slots, m === 'blame' && holdsUncommitted(at, views.blame))
}

/**
 * The lens a deck's title slide is drawn in, and the one findings maps are drawn in.
 *
 * **Findings maps are drawn in a lens with nothing to say there.** They are greyed and shaded,
 * so the lens's colour is gone from them — but not its texture: drawn in the window's reading
 * lens, a stale wedge's hatching showed through the shade, a pattern no key explained. Clones
 * is one flat neutral nearly everywhere; the others stand in where it is locked.
 */
export function reportLenses(locks: Partial<Record<ColorMode, Locked>>, windowMode: ColorMode, pages: ColorMode[]) {
  const heroLens = locks[windowMode] ? (pages[0] ?? windowMode) : windowMode
  const findingsLens = (['clones', 'composition', 'language'] as ColorMode[]).find((m) => !locks[m]) ?? heroLens
  return { heroLens, findingsLens }
}
