import {
  heatColor,
  isAnalyzed,
  rampStop,
  readingWords,
  shareRamp,
  showsShare,
  type Node,
  type Ramp,
} from './api'
import { inkOn } from './ink'

/** What the colour in the sunburst means. One geometry, five encodings. */
export type ColorMode = 'surprise' | 'churn' | 'age' | 'blame' | 'language'

export const MODE_LABEL: Record<ColorMode, string> = {
  surprise: 'Surprise',
  churn: 'Churn',
  age: 'Age',
  blame: 'Blame',
  language: 'Language',
}

export const MODE_HINT: Record<ColorMode, string> = {
  surprise: 'what a reader didn’t see coming',
  churn: 'how much it has changed lately',
  age: 'how long since anyone touched it',
  blame: 'who committed to it last',
  language: 'what it is written in',
}

/**
 * Categorical palette for blame and language.
 *
 * Qualitative, not a ramp — these are names, and any sequential scale would imply an
 * order that does not exist. Chosen to stay distinguishable under the common colour
 * vision deficiencies by separating on lightness as well as hue, which a rainbow does
 * not. Deliberately muted: a categorical field can fill the whole chart, and at that
 * coverage saturated colours are unreadable.
 */
/**
 * Four slots, assigned by rank — biggest category first — and never cycled.
 *
 * Four is a measured ceiling, not a preference: in a sunburst any wedge can end up
 * beside any other, so the palette must hold under all-pairs comparison, and no larger
 * set clears it on this surface. Hashing a name to a slot, which is what this used to
 * do, is worse still — it cycles, so two languages can collide by luck no matter how
 * few there are. That is what put rust and python on near-identical browns.
 *
 * Everything past the fourth folds into "Other" in the structural neutral. The skill's
 * rule and the honest one: a fifth series is never an invented hue.
 */
const CATEGORICAL = ['var(--cat-1)', 'var(--cat-2)', 'var(--cat-3)', 'var(--cat-4)']
export const OTHER = 'var(--structure)'
export const OTHER_LABEL = 'other'

/** Rank → colour. Beyond the palette, everything is "Other". */
export function slotColor(rank: number): string {
  return rank < CATEGORICAL.length ? CATEGORICAL[rank] : OTHER
}

/** A ramped fill, the stop it sits nearest, and the ink that survives on it. The three
 *  move together and always have to: a caller that took the fill without the ink is how
 *  every label in the map came to be one colour over a ramp spanning 6:1 of lightness.
 *  See `ink.ts`. */
function ramped(v: number, ramp: Ramp = 'heat'): Paint {
  const stop = rampStop(v, ramp)
  return { fill: heatColor(v, ramp), stop, ink: inkOn(stop) }
}

/** Older reads cooler. Anything past a year is simply "old" — the difference between two
 *  and three years is not something anyone acts on, and a linear scale would spend most
 *  of its range on it. */
function ageRamp(days: number): number {
  return 1 - Math.min(1, Math.log10(Math.max(days, 1) + 1) / Math.log10(366))
}

/** What a wedge is painted with, and what a name printed ON it has to be set in.
 *
 *  `stop` is the fill as a custom-property NAME, which `inkOn` can read and a
 *  `color-mix()` fill cannot — it is here for the callers that draw the wedge at less
 *  than full opacity and so have to re-derive the ink against what the eye receives. */
export interface Paint {
  fill: string
  stop: string
  ink: string
}

/**
 * The colour for one wedge under one mode, plus what to say about it.
 *
 * Returns null when the mode has nothing to say for this node — no history, no language,
 * nothing analysed. The caller paints those with the structural neutral rather than
 * inventing a value, which is the same rule the whole app follows: absence is stated,
 * never filled in.
 */
export function colorFor(
  node: Node,
  mode: ColorMode,
  ranks?: Map<string, number>,
): (Paint & { label: string }) | null {
  const s = node.score

  if (mode === 'surprise') {
    if (!s || !isAnalyzed(node)) return null
    const share = showsShare(node)
    const t = share ? s.hotShare : s.surprise
    // The fill is calibrated and the label is not, and that split is the whole point:
    // `shareRamp` decides where 9% lands on the colour bar, the label says 9%. Ramping
    // the printed number too would report the calibration as if it were the reading.
    // A function a reader read is named, not numbered — its scale has four steps and a
    // printed 62 claims otherwise. A container keeps its percentage: that one is a
    // roll-up of many readings in surprise space, where every digit is earned.
    return {
      ...ramped(share ? shareRamp(t) : t),
      label: share
        ? `${Math.round(t * 100)}% hot`
        : (readingWords(node)?.heat ?? `${Math.round(t * 100)}°`),
    }
  }

  if (mode === 'churn') {
    if (!s || s.ageDays === null) return null
    return {
      ...ramped(s.churn, 'churn'),
      label: s.commits > 0 ? `${s.commits} commits in 90d` : 'untouched in 90d',
    }
  }

  if (mode === 'age') {
    if (!s || s.lastTouchedDays === null) return null
    const d = s.lastTouchedDays
    return {
      ...ramped(ageRamp(d), 'age'),
      label: d < 1 ? 'touched today' : `touched ${Math.round(d)}d ago`,
    }
  }

  const key = mode === 'blame' ? node.lastAuthor : node.lang
  if (!key) return null
  const rank = ranks?.get(key)
  const slot = rank === undefined ? OTHER : slotColor(rank)
  return {
    fill: slot,
    stop: slot,
    ink: inkOn(slot),
    // The label names the value even when the colour is "Other", so identity is never
    // carried by colour alone — which is what makes the 6.9 CVD margin legal.
    label: key,
  }
}

/** Category → slot index, biggest first by lines. Computed once per scan so every wedge
 *  and the legend agree, and so a colour follows the entity rather than its position on
 *  screen. */
export function rankCategories(root: Node, mode: ColorMode): Map<string, number> {
  const m = new Map<string, number>()
  legendFor(root, mode).forEach((name, i) => m.set(name, i))
  return m
}

/** One row of the panel's breakdown: a slice of the picture, its colour, and its members. */
export interface Bucket {
  key: string
  label: string
  fill: string
  /** The functions in it, so the row can put them in a list. */
  nodes: Node[]
  lines: number
}

/** Churn bands, in the order the panel lists them — busiest first, because that is the end
 *  of this ramp anyone opens the mode to find. Upper bound is exclusive. */
const CHURN_BANDS: { label: string; min: number }[] = [
  { label: '10+ commits', min: 10 },
  { label: '3–9 commits', min: 3 },
  { label: '1–2 commits', min: 1 },
  { label: 'untouched in 90d', min: 0 },
]

/** Age bands, most recent first. The boundaries are the ones people actually say out loud
 *  — today, this week, this month, this quarter — rather than an even split of a log ramp,
 *  which would be defensible and unreadable. */
const AGE_BANDS: { label: string; under: number }[] = [
  { label: 'today', under: 1 },
  { label: 'this week', under: 7 },
  { label: 'this month', under: 30 },
  { label: 'this quarter', under: 90 },
  { label: 'older', under: Infinity },
]

/**
 * The subtree broken into the slices the current mode is painting it in.
 *
 * **One walk, and the colours come from `colorFor`'s own inputs rather than a second
 * palette.** A panel that invented its own fills would be a legend disagreeing with the
 * map it sits beside — the failure `Spread` already calls out for the grade ramp, which is
 * why its segments are drawn from `heatColor` too.
 *
 * Scoped like `summarize`: functions a `.sanityignore` set aside are left out, so the
 * bucket counts add up to the `functions` total in the header above them. They are still
 * drawn on the map, and the header still names them separately — what they are not is
 * silently folded into somebody's line count.
 *
 * A ramped mode's band takes the ramp colour at the MEAN of its members' ramp inputs, so
 * every swatch here is a colour actually on screen rather than a representative guess. The
 * bands are fixed and the colours are measured; doing it the other way round would put a
 * swatch in the key that no wedge is wearing.
 *
 * Whatever the mode cannot colour gets a final bucket in the structural neutral rather than
 * being dropped. Absence is stated, never filled in — and never quietly excluded from a
 * total either, which is how a breakdown comes to describe a subset of the picture.
 */
export function bucketsFor(root: Node, mode: ColorMode, ranks?: Map<string, number>): Bucket[] {
  if (mode === 'surprise') return []

  const bucket = new Map<string, Bucket>()
  /** Ramp inputs per bucket, kept only long enough to average them into a fill. */
  const ramps = new Map<string, number[]>()
  const put = (key: string, label: string, fill: string, n: Node, ramp?: number) => {
    let b = bucket.get(key)
    if (!b) {
      b = { key, label, fill, nodes: [], lines: 0 }
      bucket.set(key, b)
    }
    b.nodes.push(n)
    b.lines += n.loc
    if (ramp !== undefined) {
      const r = ramps.get(key) ?? []
      r.push(ramp)
      ramps.set(key, r)
    }
  }

  const UNKNOWN = ' unknown'
  const walk = (n: Node, out: boolean) => {
    const outOfScope = out || n.excluded
    if (n.kind === 'func' && !outOfScope) {
      const s = n.score
      if (mode === 'blame' || mode === 'language') {
        const key = mode === 'blame' ? n.lastAuthor : n.lang
        if (key) {
          const rank = ranks?.get(key)
          put(key, key, rank === undefined ? OTHER : slotColor(rank), n)
        } else {
          put(UNKNOWN, mode === 'blame' ? 'uncommitted' : 'unknown', 'var(--unanalyzed)', n)
        }
      } else if (mode === 'churn') {
        // Same gate `colorFor` uses, so a wedge the map left grey is not given a band here.
        if (s && s.ageDays !== null) {
          const band = CHURN_BANDS.find((b) => s.commits >= b.min) ?? CHURN_BANDS[CHURN_BANDS.length - 1]
          put(band.label, band.label, '', n, s.churn)
        } else {
          put(UNKNOWN, 'no git history', 'var(--unanalyzed)', n)
        }
      } else {
        if (s && s.lastTouchedDays !== null) {
          const d = s.lastTouchedDays
          const band = AGE_BANDS.find((b) => d < b.under) ?? AGE_BANDS[AGE_BANDS.length - 1]
          put(band.label, band.label, '', n, ageRamp(d))
        } else {
          put(UNKNOWN, 'no git history', 'var(--unanalyzed)', n)
        }
      }
    }
    n.children.forEach((c) => walk(c, outOfScope))
  }
  walk(root, false)

  for (const [key, vals] of ramps) {
    const b = bucket.get(key)
    if (!b || vals.length === 0) continue
    const mean = vals.reduce((a, v) => a + v, 0) / vals.length
    b.fill = ramped(mean, mode === 'churn' ? 'churn' : 'age').fill
  }

  const out = [...bucket.values()]
  if (mode === 'blame' || mode === 'language') {
    // By lines, matching `legendFor` — so the panel lists them in the order the map's own
    // legend does, and the biggest slice of the picture is the first row in both.
    out.sort((a, b) => b.lines - a.lines)
  } else {
    const order = mode === 'churn' ? CHURN_BANDS.map((b) => b.label) : AGE_BANDS.map((b) => b.label)
    out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  }
  // Whatever the mode could not colour goes last whichever way the rest is sorted: it is
  // the one row that is not a value, and interleaving it by size would read as one.
  return [...out.filter((b) => b.key !== UNKNOWN), ...out.filter((b) => b.key === UNKNOWN)]
}

/** The distinct values present, for a legend. Categorical modes need one; ramps don't. */
export function legendFor(root: Node, mode: ColorMode): string[] {
  if (mode !== 'blame' && mode !== 'language') return []
  const seen = new Map<string, number>()
  const walk = (n: Node) => {
    const key = mode === 'blame' ? n.lastAuthor : n.lang
    if (key && n.kind === 'func') seen.set(key, (seen.get(key) ?? 0) + n.loc)
    n.children.forEach(walk)
  }
  walk(root)
  // By lines, so the legend is ordered by how much of the picture each one actually is.
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
}
