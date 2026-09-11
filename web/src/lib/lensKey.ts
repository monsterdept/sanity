import type { Ramp } from './api'
import {
  CALLER_KEY,
  KIND_FILL,
  MODE_LABEL,
  NAMED,
  REACH_KEY,
  rampEnds,
  rampOf,
  shared,
  slotColor,
  type ColorMode,
  type Views,
} from './colorMode'

/**
 * What a lens's key says, before anybody draws it.
 *
 * **One answer for three surfaces.** The key beside the map, the key in an exported movie and
 * the key on a report page each used to decide for themselves what a lens's key held — and the
 * movie's copy had quietly stopped agreeing: it knew ramps and ranked casts and nothing else, so
 * Callers, Reach, Clones and Traps came out with an empty key, and Composition was coloured by
 * RANK while its wedges are coloured by kind. That is the failure `ColorKey` records paying for
 * once already, one surface over. What each surface keeps is its own drawing: the window's key
 * wraps a disc, a frame's is Canvas2D in a margin, a page's is Canvas2D under the map.
 *
 * Fills are CSS colours as the map paints them — `var(--…)` or a `color-mix()` — never resolved
 * values, so a key drawn off-screen resolves them against the ground it is being drawn on.
 */
export type LensKey =
  /** A calibrated scale: the ramp the wedges walk, and the words for its two ends. */
  | { kind: 'ramp'; title: string; ramp: Ramp; ends: [string, string] }
  /** A fixed set of states or bands, each with its own swatch, in the order to show them. */
  | { kind: 'swatches'; title: string; entries: KeyEntry[] }
  /** A ranked cast — Blame, Language. `entries` is everyone the key names; the rest are
   *  counted, split by whether the map is still colouring them. See `ColorKey`'s tail. */
  | {
      kind: 'cast'
      title: string
      entries: KeyEntry[]
      /** Past the names, still coloured — the palette recycles into its unnamed range. */
      coloured: number
      /** Whether any of those share a shade with somebody else. */
      repeats: boolean
      /** Unranked, drawn in the structural neutral. */
      neutral: number
      /** The picture holds lines nobody has committed, painted as themselves. */
      uncommitted: boolean
    }

export interface KeyEntry {
  label: string
  fill: string
}

/**
 * The key for one lens over one picture.
 *
 * `categories` is what the picture holds (`legendFor`), and `ranks` the slot map the wedges are
 * painted from. The two are the caller's because they depend on what is being drawn — the drilled
 * subtree on screen, the whole repo on a report page.
 *
 * Null where there is nothing to key: a cast with nobody in it, or a composition holding no kind.
 * A ramp drawn under a categorical lens with no categories would be a scale over a picture that
 * has none, and a key naming nothing is a box.
 */
export function lensKey(
  mode: ColorMode,
  views: Views,
  categories: string[],
  ranks: Map<string, number> | undefined,
  /** Whether the picture holds uncommitted lines — see `holdsUncommitted`.
   *
   *  **Blame paints them as themselves, in `--unanalyzed`, and the key used not to say so.** A
   *  state is never a slot, so they are not in `categories` — and a report of a working tree
   *  mid-edit came out with grey wedges under a key naming one author. Its own flag rather than
   *  a category, because `rankCategories` builds slots out of that list. */
  uncommitted = false,
): LensKey | null {
  const title = MODE_LABEL[mode]

  // **Before the cast, because Composition has categories too** — and its colours are FIXED per
  // kind rather than ranked. The order is this key's own and does not move between repos; only
  // which rows appear depends on what is there.
  if (mode === 'composition') {
    const rows: [string, string][] = [
      [KIND_FILL.vendored, 'vendored'],
      [KIND_FILL.generated, 'generated'],
      [KIND_FILL.test, 'test'],
      [KIND_FILL.header, 'header'],
      [KIND_FILL.code, 'code'],
      ['var(--unanalyzed)', 'unplaced'],
    ]
    const entries = rows
      .filter(([, label]) => categories.includes(label))
      .map(([fill, label]) => ({ label, fill }))
    return entries.length > 0 ? { kind: 'swatches', title, entries } : null
  }

  if (mode === 'blame' || mode === 'language' || categories.length > 0) {
    if (categories.length === 0 && !uncommitted) return null
    // An unranked category is `other`, never this list's own index — see `ColorKey`.
    const unranked = Number.MAX_SAFE_INTEGER
    const rank = (c: string) => ranks?.get(c) ?? unranked
    const entries = categories
      .filter((c) => rank(c) < NAMED)
      .sort((a, b) => rank(a) - rank(b))
      .map((label) => ({ label, fill: slotColor(rank(label)) }))
    let coloured = 0
    let neutral = 0
    let repeats = false
    for (const c of categories) {
      if (rank(c) < NAMED) continue
      const r = ranks?.get(c)
      if (r === undefined) neutral += 1
      else {
        coloured += 1
        if (shared(r)) repeats = true
      }
    }
    return { kind: 'cast', title, entries, coloured, repeats, neutral, uncommitted }
  }

  // A trap is a boolean somebody reported, so its key is one swatch — the ordinary case needs
  // none. Clones names all three, because `too small` is not a finding and a reader who saw only
  // the purple could not tell a clean repo from an unmeasured one.
  if (mode === 'traps') return { kind: 'swatches', title, entries: [{ label: 'trap', fill: 'var(--trap)' }] }
  if (mode === 'clones') {
    return {
      kind: 'swatches',
      title,
      entries: [
        { label: 'a clone', fill: 'var(--clone)' },
        { label: 'unique', fill: 'var(--structure)' },
        { label: 'too small', fill: 'var(--unanalyzed)' },
      ],
    }
  }
  // Bands, not a bar — the paint is four shades however continuous the count.
  if (mode === 'callers' || mode === 'reach') {
    const bands = mode === 'callers' ? CALLER_KEY : REACH_KEY
    return { kind: 'swatches', title, entries: bands.map(([fill, label]) => ({ label, fill })) }
  }

  return { kind: 'ramp', title, ramp: rampOf(mode), ends: rampEnds(mode, views) ?? ['', ''] }
}
