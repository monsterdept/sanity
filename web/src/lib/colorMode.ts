import {
  GRADE_SURPRISE,
  LEGIBLE_WORDS,
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

/** What the colour in the sunburst means. One geometry, seven encodings.
 *
 *  `surprise`, `legible` and `traps` all come from a reader's report and answer three
 *  different questions about it: could you reach the intent from outside, was the body clear
 *  once open, and will it bite the next person to edit it. They are lenses rather than one
 *  blended number because they disagree — a body can be unguessable and plain, or guessable,
 *  plain, and mined. Blending them would average away the exact distinction they exist for;
 *  switching between them makes it a blink comparison. */
export type ColorMode =
  | 'surprise'
  | 'legible'
  | 'traps'
  | 'language'
  | 'blame'
  | 'churn'
  | 'age'

/**
 * The order on screen, and therefore the ⌘-digits — the switcher, its tooltips and the key
 * handler all read this one list, so there is nothing for them to drift from.
 *
 * **The right-hand end is a widening time window.** Blame is a point (who touched it last),
 * churn is a 90-day span, age is unbounded, and History — the mode past the end of the row —
 * is the whole timeline. Entering it is then a continuation of the gesture rather than a
 * mode change out of nowhere.
 *
 * Every lens is named for its BRIGHT end, because the map has one invariant — bright is the
 * thing you have to do something about. `Surprise` obeyed it and `Legibility` did not: more
 * colour meant LESS of what that tab was called, so the two lenses ran in opposite polarity
 * while painting bad-as-bright identically. Surprise and opacity are the parallel pair.
 *
 * The mode KEY stays `legible`, matching `Report.legible` — the wire field and the committed
 * store both say `legible: full`, and renaming the display word must never reach them.
 *
 * The three lenses painted from a reader's report lead, because Surprise is what the app is
 * for. `language` divides them from the git-derived three: it is the only lens painted from
 * neither a reading nor a commit, which makes it the seam rather than an orphan on the end.
 */
export const MODE_LABEL: Record<ColorMode, string> = {
  surprise: 'Surprise',
  legible: 'Opacity',
  traps: 'Traps',
  language: 'Language',
  blame: 'Blame',
  churn: 'Churn',
  age: 'Age',
}

export const MODE_HINT: Record<ColorMode, string> = {
  surprise: 'what a reader didn’t see coming',
  legible: 'how hard it is to follow once you open it',
  traps: 'what will bite whoever edits it next',
  language: 'what it is written in',
  blame: 'who committed to it last',
  churn: 'how much it has changed lately',
  age: 'how long since anyone touched it',
}

/** Which lenses are painted from a reader's report rather than from git or the parse.
 *
 *  They share the things that follow from that: a wedge with no reading is grey rather than
 *  coloured, a stale reading is hatched because its grade describes a body that has changed,
 *  and the legend has to say so. Asking it once here stops three call sites each deciding
 *  for themselves and drifting — the stale hatch was `mode === 'surprise'` in two places and
 *  would have silently stopped marking anything under the two new lenses. */
export function paintsFromReadings(mode: ColorMode): boolean {
  return mode === 'surprise' || mode === 'legible' || mode === 'traps'
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

/** What the ramp spans for a caller that has a node but not the tree it came from. A
 *  year, which is what the scale was fixed at before it was normalised. */
const SPAN_UNKNOWN_DAYS = 365

/** How far back this repo goes, in days, as the age ramp should span it.
 *
 *  `ageDays` rolls up as the MAX of a node's children — see `Node::aggregate` — so the
 *  root's is the oldest thing anybody has touched, which is the repo's own lifespan as far
 *  as blame can see it. No extra walk.
 *
 *  **No floor.** A floor was tried and it was wrong: in a repo three days old, the thing
 *  written on day one really has been left alone for two thirds of the project's life, and
 *  a scale that refuses to say so is answering a question about some other repo. The span
 *  is whatever the repo is, however short. */
export function ageSpanOf(root: Node): number {
  return Math.max(root.score?.ageDays ?? 0, 0)
}

/** Older reads cooler, across the span the REPO actually covers.
 *
 *  It was a fixed 366 days, and on a young project that is a scale with nothing on it: this
 *  repo is a week old, so every wedge landed in the top few percent and the map was one flat
 *  green. The lens worked and the calibration was borrowed from somebody else's repo.
 *
 *  Normalising costs something real and it is worth saying out loud: a green wedge here and
 *  a green wedge in a ten-year-old repo are no longer the same fact. That is already true of
 *  every other lens on this map — surprise is calibrated per repo, churn is a share of a
 *  window, blame slots are ranked within one project — and a colour that means "old FOR
 *  THIS CODEBASE" is the reading anybody actually wants. Cross-repo comparison was never
 *  something this app offered.
 *
 *  The span is the repo's, however short, and the oldest thing in it always lands at the
 *  cold end. That is the point rather than a rough edge: in a project three days old, what
 *  somebody wrote on day one HAS been left alone for two thirds of its life, and a scale
 *  with a minimum span would refuse to say so — answering, at that point, a question about
 *  some other repo.
 *
 *  Still logarithmic within the span, for the reason it always was: the difference between
 *  the oldest thing here and the second oldest is not what anyone opens this mode to see. */
function ageRamp(days: number, span: number): number {
  const s = Math.max(span, 0)
  // Everything here is younger than a day, so there is no span to spread anything across
  // and every wedge is equally recent. Without this the ratio is 0/0 at the bottom of the
  // scale and a repo where all the work happened this morning would paint itself ancient.
  if (s < 1) return 1
  const d = Math.min(Math.max(days, 0), s)
  return 1 - Math.log10(d + 1) / Math.log10(s + 1)
}

/**
 * The share of a subtree's READ lines that a reader found hard to get through.
 *
 * The analogue of `hot_share`, computed here rather than in Rust because `legible` arrives
 * with the readings rather than with the scan — the tree is folded in the browser, so this
 * is the only side that has it.
 *
 * **Denominator is lines that were READ, not lines that exist.** A directory where one
 * function of forty has been read and came back opaque is not 2.5% opaque; it is opaque as
 * far as anyone has looked. Dividing by everything would let coverage masquerade as quality
 * and make every unread repo look pristine — the same trap `assessed` avoids by excluding
 * stale rather than counting it as progress.
 *
 * `null` when nothing under it has been read, which the caller paints grey. Absence stated,
 * never filled in.
 *
 * Walks the subtree on each call. That is affordable because every caller memoises container
 * fills per mode — see `Sunburst`'s `fills` — so this runs once per lens change, not per
 * frame. If that ever stops being true this wants precomputing at fold time.
 */
function opaqueShare(node: Node): number | null {
  let read = 0
  let opaque = 0
  const walk = (n: Node) => {
    if (n.kind === 'func' && n.agent && !n.agentStale && n.agent.legible) {
      read += n.loc
      // `some` and `none` are the two grades that mean a reader had to work for it.
      if (n.agent.legible === 'some' || n.agent.legible === 'none') opaque += n.loc
    }
    n.children.forEach(walk)
  }
  walk(node)
  return read === 0 ? null : opaque / read
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
  /** The repo's own span for the age ramp, from `ageSpanOf(root)`. Optional because a
   *  caller that has a node but not the tree it came from should still get a colour —
   *  it falls back to the floor, which is the old fixed scale's short end. */
  ageSpan?: number,
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

  if (mode === 'legible') {
    // Containers roll up, exactly as they do under surprise.
    //
    // An earlier version left them neutral, on the argument that half a subtree being
    // unreadable is not "somewhat readable". That was wrong for the same reason it would be
    // wrong for surprise: nobody asks a directory to have a legibility, they ask HOW MUCH OF
    // IT is hard to read — and that is a share, which aggregates honestly. Leaving the inner
    // rings grey also threw away the one thing the map can say that a list cannot, which is
    // where the unreadable code CLUSTERS.
    if (showsShare(node)) {
      const share = opaqueShare(node)
      if (share === null) return null
      return { ...ramped(shareRamp(share), 'legible'), label: `${Math.round(share * 100)}% opaque` }
    }
    const g = node.agent && !node.agentStale ? node.agent.legible : undefined
    if (!g) return null
    return { ...ramped(GRADE_SURPRISE[g], 'legible'), label: LEGIBLE_WORDS[g] }
  }

  if (mode === 'traps') {
    // Two states and an absence, not a ramp: a trap is a boolean and shading it would
    // invent degrees of danger nobody reported. Read-and-clear is drawn in the structural
    // neutral rather than left grey, because "a reader looked and found nothing" and
    // "nobody has looked" are opposite facts and this is the one lens where confusing them
    // would read as an all-clear.
    if (!node.agent || node.agentStale) return null
    const trap = node.agent.trap === true
    const fill = trap ? 'var(--trap)' : 'var(--structure)'
    return { fill, stop: fill, ink: inkOn(fill), label: trap ? 'trap' : 'no trap reported' }
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
      ...ramped(ageRamp(d, ageSpan ?? SPAN_UNKNOWN_DAYS), 'age'),
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
export function bucketsFor(
  root: Node,
  mode: ColorMode,
  ranks?: Map<string, number>,
  /** The REPO's span, when the caller has it. `root` here is whatever is on screen, which
   *  under a drill is one directory — deriving the span from it would put the panel on a
   *  different scale from the map beside it the moment you drilled in. */
  ageSpan?: number,
): Bucket[] {
  if (mode === 'surprise') return []

  // The caller's span when there is one, and this subtree's only as a fallback for a caller
  // that has no tree above it.
  const span = ageSpan ?? ageSpanOf(root)
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

  /** The bucket key for "no author" / "no language", kept out of the namespace real keys
   *  live in: an author genuinely called `unknown` must not land in the absence row.
   *
   *  Written as the ESCAPE, never as a literal NUL. It was a literal one, which made this
   *  file BINARY to every tool that samples for a zero byte — `grep` and `rg` matched
   *  nothing in it and said so only if asked, `git diff` refused to show it, and one editor
   *  round-trip would have dropped the byte and folded the absence row into a real category
   *  with nothing failing. Identical at runtime, legible in the source. */
  const UNKNOWN = '\u0000unknown'
  const walk = (n: Node, out: boolean) => {
    const outOfScope = out || n.excluded
    if (n.kind === 'func' && !outOfScope) {
      const s = n.score
      if (mode === 'legible' || mode === 'traps') {
        // Both are read straight off the reading, so both share one absence: a function
        // nobody has read yet. It is a bucket rather than a drop, for the same reason the
        // map greys it rather than hiding it — a breakdown that silently omits the unread
        // reports a coverage it has not got.
        const r = n.agent && !n.agentStale ? n.agent : undefined
        if (!r) {
          put(UNKNOWN, 'not read yet', 'var(--unanalyzed)', n)
        } else if (mode === 'traps') {
          const trap = r.trap === true
          put(
            trap ? 'trap' : 'clear',
            trap ? 'trap' : 'no trap reported',
            trap ? 'var(--trap)' : 'var(--structure)',
            n,
          )
        } else if (r.legible) {
          put(r.legible, LEGIBLE_WORDS[r.legible], heatColor(GRADE_SURPRISE[r.legible], 'legible'), n)
        } else {
          put(UNKNOWN, 'not graded', 'var(--unanalyzed)', n)
        }
      } else if (mode === 'blame' || mode === 'language') {
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
          put(band.label, band.label, '', n, ageRamp(d, span))
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
  } else if (mode === 'traps') {
    // Traps first: it is the only row anybody opens this lens to find.
    out.sort((a, b) => Number(b.key === 'trap') - Number(a.key === 'trap'))
  } else if (mode === 'legible') {
    const order: string[] = ['none', 'some', 'most', 'full']
    out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
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
