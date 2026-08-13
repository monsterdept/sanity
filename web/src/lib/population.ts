import { isAnalyzed, temperature, type Node } from './api'

/**
 * The repo's own functions, as the distributions one of them can be placed in.
 *
 * A container's pane is an aggregate and cannot be anything else — a directory has no
 * length, no reading and no churn of its own, only its children's. A FUNCTION has all
 * three, and the fact the panel could never state is the one that needs a population:
 * twenty-eight lines is long or short only against the code it sits in.
 *
 * **The repo, not the file.** The file is what the reader was shown as peers, and ranking
 * against it was the other candidate — but half this repo's files hold fewer than a dozen
 * functions, and "2nd of 3" is a rank with no distribution behind it. The repo is also the
 * population the map is colored against, so a percentile printed here and a wedge's color
 * are answering on one scale.
 *
 * Each array holds only the functions ENTITLED to be in it, which is why there are three
 * rather than one walk with three fields:
 *  - `loc` is every function, because every function has a length.
 *  - `heat` is only the analyzed ones. An unscored function is not a cold one, and padding
 *    the distribution with zeroes would make every real reading look hotter than it is.
 *  - `commits` is only the ones under git. No history is not "never touched" — see the
 *    churn dial, which draws an empty track rather than a needle at zero for the same
 *    reason.
 */
export interface Population {
  /** Lines per function, ascending. */
  loc: number[]
  /** Temperature per analyzed function, ascending. */
  heat: number[]
  /** Commits in the 90-day window per function with history, ascending. */
  commits: number[]
}

export function populationOf(root: Node): Population {
  const loc: number[] = []
  const heat: number[] = []
  const commits: number[] = []
  const walk = (n: Node) => {
    // `rest` is the synthetic wedge a crowded band collapses into — a stand-in for hundreds
    // of functions wearing one function's `kind`. Counting it as a member would put a
    // roll-up in the distribution its own members are ranked against.
    if (n.kind === 'func' && n.rest === undefined) {
      loc.push(n.loc)
      if (isAnalyzed(n)) heat.push(temperature(n.score))
      if (n.score && n.score.ageDays !== null) commits.push(n.score.commits)
    }
    for (const c of n.children) walk(c)
  }
  walk(root)
  const asc = (a: number, b: number) => a - b
  loc.sort(asc)
  heat.sort(asc)
  commits.sort(asc)
  return { loc, heat, commits }
}

/**
 * Where `v` sits in a sorted population: the share of it strictly below, 0..1.
 *
 * **Strictly below, and ties are not split.** `28 lines` in a repo where forty other
 * functions are also twenty-eight lines long is not "longer than" any of them, and the
 * mid-rank convention would report half of them as shorter — a hair more accurate as a
 * statistic and a false sentence in English, which is what this number is rendered as.
 *
 * Null under `MIN_POP`, which is the same rule every other term in this app follows: a
 * percentile over eight functions is a rank wearing two significant figures. It reads as
 * gray rather than as a confident number nobody should trust.
 */
const MIN_POP = 20

export function shareBelow(sorted: number[], v: number): number | null {
  if (sorted.length < MIN_POP) return null
  let lo = 0
  let hi = sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (sorted[mid] < v) lo = mid + 1
    else hi = mid
  }
  return lo / sorted.length
}
