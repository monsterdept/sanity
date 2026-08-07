import { heatColor, isAnalyzed, readingWords, showsShare, type Node } from './api'

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

/** Older reads cooler. Anything past a year is simply "old" — the difference between two
 *  and three years is not something anyone acts on, and a linear scale would spend most
 *  of its range on it. */
function ageRamp(days: number): number {
  return 1 - Math.min(1, Math.log10(Math.max(days, 1) + 1) / Math.log10(366))
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
): { fill: string; label: string } | null {
  const s = node.score

  if (mode === 'surprise') {
    if (!s || !isAnalyzed(node)) return null
    const share = showsShare(node)
    const t = share ? s.hotShare : s.surprise
    // A function a reader read is named, not numbered — its scale has four steps and a
    // printed 62 claims otherwise. A container keeps its percentage: that one is a
    // roll-up of many readings in surprise space, where every digit is earned.
    return {
      fill: heatColor(t),
      label: share
        ? `${Math.round(t * 100)}% hot`
        : (readingWords(node)?.heat ?? `${Math.round(t * 100)}°`),
    }
  }

  if (mode === 'churn') {
    if (!s || s.ageDays === null) return null
    return {
      fill: heatColor(s.churn, 'churn'),
      label: s.commits > 0 ? `${s.commits} commits in 90d` : 'untouched in 90d',
    }
  }

  if (mode === 'age') {
    if (!s || s.lastTouchedDays === null) return null
    const d = s.lastTouchedDays
    return {
      fill: heatColor(ageRamp(d), 'age'),
      label: d < 1 ? 'touched today' : `touched ${Math.round(d)}d ago`,
    }
  }

  const key = mode === 'blame' ? node.lastAuthor : node.lang
  if (!key) return null
  const rank = ranks?.get(key)
  return {
    fill: rank === undefined ? OTHER : slotColor(rank),
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
