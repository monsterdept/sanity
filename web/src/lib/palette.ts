/**
 * How many colors a categorical lens spends, stored per lens.
 *
 * The number itself, and why it is a control rather than a constant, is `CAPS` in
 * `colorMode.ts` — this file is only where the answer lives between sessions.
 *
 * **Per lens, because the two lenses are not asking the same question.** Blame on a large
 * repo is four hundred people and the reader almost always means "who are the ten that
 * matter"; Language is nine values and capping it at eight would grey out Rust to no
 * purpose. One shared number would make every visit to the second lens undo the choice made
 * on the first.
 *
 * Not per project, for the reason `rings.ts` gives: the same person on the same screen wants
 * the same density whatever repo they open, and a per-repo copy is a second place for it to
 * drift. Stored like every other display preference here, down to failing quietly when
 * storage is unavailable.
 */

import { CAP_DEFAULT, CAPS, type ColorMode } from './colorMode'

/** The lenses that spend colors at all. The ramps have no cap to set. */
export type Capped = 'blame' | 'language'

export function isCapped(mode: ColorMode): mode is Capped {
  return mode === 'blame' || mode === 'language'
}

/** What the stepper prints. `Infinity` is `all` rather than a number, because it is a rule —
 *  everybody gets a color, recycling shades once the palette runs out — and printing `∞`
 *  over a repo with nine languages would be answering a question nobody asked. */
export function capLabel(cap: number): string {
  return Number.isFinite(cap) ? String(cap) : 'all'
}

const KEY = (mode: Capped) => `sanity.colors.${mode}`

/** Snapped to a step rather than refused, the way `loadRings` clamps: a stored value from a
 *  build with a different range is a preference somebody expressed, and the nearest step this
 *  build offers is closer to it than the default is. */
export function loadCap(mode: Capped): number {
  try {
    const raw = localStorage.getItem(KEY(mode))
    if (raw === null) return CAP_DEFAULT
    const n = Number(raw)
    // `Infinity` lands here as a non-finite number and is the default anyway, so it needs no
    // case of its own — which is the only reason writing it as a word is safe.
    if (!Number.isFinite(n)) return CAP_DEFAULT
    const steps = CAPS.filter((c) => Number.isFinite(c))
    return steps.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best))
  } catch {
    /* storage unavailable — the default is a fine answer */
  }
  return CAP_DEFAULT
}

export function saveCap(mode: Capped, cap: number): void {
  try {
    // `Infinity` does not survive a round trip through `Number(localStorage.getItem(...))` —
    // `String(Infinity)` is `"Infinity"`, which `Number` reads back correctly, but only
    // because JS spells it that way; written as a plain number to keep the file's own reader
    // honest about what it is parsing.
    localStorage.setItem(KEY(mode), Number.isFinite(cap) ? String(cap) : 'Infinity')
  } catch {
    /* the preference just won't survive a restart */
  }
}
