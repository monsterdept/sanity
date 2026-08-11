import {
  DOC_GAP,
  DOC_WORDS,
  GRADE_SURPRISE,
  LEGIBLE_WORDS,
  heatColor,
  isAnalyzed,
  legibleOf,
  rampStop,
  readingWords,
  shareRamp,
  showsShare,
  type Grade,
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
  | 'docs'
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
 * Named for the SUBJECT, and the colour carries the direction. This tab was `Opacity` for a
 * while, on the rule that a lens should be named for its bright end — and that rule cost more
 * than it bought here, because `opaque` is an optical word and optically clear means light
 * gets THROUGH. So the tab, its rows (`crystal`, `murky`) and the ramp were in a three-way
 * argument: bright meant "act on this", the words meant "more light", and the two point
 * opposite ways. `Legibility` names what is being asked about and lets the ramp say which end
 * needs work, which is what every other tab does — `Churn` is not called `Churning`.
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
  legible: 'Legibility',
  docs: 'Docs',
  traps: 'Traps',
  language: 'Language',
  blame: 'Blame',
  churn: 'Churn',
  age: 'Age',
}

export const MODE_HINT: Record<ColorMode, string> = {
  surprise: 'what a reader didn’t see coming',
  legible: 'what reading it was actually like',
  docs: 'what nobody has explained',
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
  return mode === 'surprise' || mode === 'legible' || mode === 'docs' || mode === 'traps'
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
 * Eight slots, assigned by rank — biggest category first — and never cycled.
 *
 * It was four, and four was a measured ceiling measured wrong: the number came from one
 * hand-picked set of eight colliding, which says nothing about what eight CAN do. Re-run
 * as a search — CIEDE2000 under normal vision and all three dichromacies, over an OKLCH
 * grid held to this app's muted range — the eight in `index.css` separate better than the
 * four they replace did (worst pair 14.3 against 7.9). The blame lens is what forced the
 * question: a repo with forty authors spent thirty-six of them in "Other".
 *
 * Rank order is the palette's own order and both are chosen for their PREFIXES, because a
 * repo with three authors only ever sees the first three. See `index.css`.
 *
 * Hashing a name to a slot, which this used to do, remains wrong at any size — it cycles,
 * so two categories can collide by luck no matter how few there are. That is what put rust
 * and python on near-identical browns.
 *
 * Everything past the eighth still folds into "Other" in the structural neutral: a ninth
 * hue costs 15% of the worst pair and keeps falling, and the tail is reachable by picking
 * it in the panel instead. A ninth series is never an invented hue.
 */
const CATEGORICAL = [
  'var(--cat-1)',
  'var(--cat-2)',
  'var(--cat-3)',
  'var(--cat-4)',
  'var(--cat-5)',
  'var(--cat-6)',
  'var(--cat-7)',
  'var(--cat-8)',
]
export const OTHER = 'var(--structure)'
export const OTHER_LABEL = 'other'
/** How many categories get a colour of their own. Exported because the legend has to
 *  name exactly the ones that have one — it counted to four itself, and a legend with its
 *  own copy of the palette's size is a legend that can disagree with the map. */
export const SLOTS = CATEGORICAL.length

/** The name git puts on a line that is in the working tree and not in a commit.
 *
 *  It arrives as an author string and it is not an author: it is a STATE, and treating it
 *  as a person cost this map twice over. It sorted second by lines in a repo mid-session
 *  and took `--cat-2`, so one of eight measured colour slots went to a non-person and a
 *  real author was pushed toward "Other" — while the legend listed it among people. Now it
 *  is an absence, like a file with no blame at all, and the two say which they are. */
const UNCOMMITTED = 'Not Committed Yet'

/** Neither an author nor a language: a fact about git's view of the line, not about who
 *  wrote it. Both are drawn in the unanalysed neutral and named for what they are. */
export function isAuthor(key: string | null): key is string {
  return key !== null && key !== UNCOMMITTED
}

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
    const g = n.kind === 'func' && !n.agentStale ? legibleOf(n.agent) : undefined
    if (g) {
      read += n.loc
      // `some` and `none` are the two grades that mean a reader had to work for it.
      if (g === 'some' || g === 'none') opaque += n.loc
    }
    n.children.forEach(walk)
  }
  walk(node)
  return read === 0 ? null : opaque / read
}

/** The reader's documentation grade for one function, or undefined.
 *
 *  **`derivable` forces it to `none`.** A doc a model could write from the body explains
 *  nothing that was not already there, so it must not paint a wedge as covered — the same
 *  rule `reportGrades` applies to the number, applied here to the colour, because a lens
 *  that disagreed with the dial beside it would be two answers to one question. */
function docGrade(n: Node): Grade | undefined {
  if (!n.agent || n.agentStale) return undefined
  return n.agent.derivable ? 'none' : (n.agent.documented ?? undefined)
}

/**
 * The share of everything underneath — files AND functions — that nobody has described.
 *
 * **Every graded thing, one vote each.** It counted only FILES for an afternoon, on the
 * argument that a directory contains files; the pane then showed a dial saying "100% doc'd"
 * over a list saying eight of thirteen functions have no docs, because the dial was counting
 * four files and the list was counting thirteen functions. Both were true and neither was
 * the other, which is the failure a single number is supposed to prevent. A person asking
 * "how documented is this directory" means everything in it that could have been described.
 *
 * **Counted by reading, not weighted by lines**, and this is the one share in this file that
 * is. The population is heterogeneous: a file's reading is about its header, a function's is
 * about its own comment, and a file's line count is the sum of its functions' — so weighting
 * by lines would count the same lines twice and let one 1,100-line component outweigh forty
 * small files nobody has described. One reading is one vote, which is also what makes files
 * and functions addable at all.
 *
 * `null` when nothing underneath has been graded, which the caller paints grey — absence
 * stated, never filled in.
 */
function undocShare(node: Node): number | null {
  let graded = 0
  let bare = 0
  const walk = (n: Node) => {
    if (n.kind === 'file' || n.kind === 'func') {
      const g = docGrade(n)
      if (g) {
        graded += 1
        if (g === 'some' || g === 'none') bare += 1
      }
    }
    n.children.forEach(walk)
  }
  walk(node)
  return graded === 0 ? null : bare / graded
}

/**
 * Whether this lens has nothing to say about this node — as opposed to something absent.
 *
 * The tooltip's swatch-and-label row states an absence rather than hiding it: `not measured
 * yet` is a fact about a function nobody has read, and dropping it would let grey pass for
 * cold. That rule needs an exception exactly where the absence is not a fact about the code
 * but about the QUESTION.
 *
 * Traps over a container is the case. A trap is one boolean a reader reported against one
 * body; a directory has no body and was never asked, so there is no reading to be missing.
 * A count of the ones underneath was tried and read worse: `16 traps` beside a neutral
 * swatch describes a colour nothing on screen is wearing, and it puts a roll-up in the one
 * slot on this card reserved for what the wedge itself is. The panel lists the sixteen by
 * name, which is what you would do with them anyway.
 *
 * Blame and Language over a DIRECTORY are the same shape and were missed with it. Both are
 * categorical — a directory is not written in a language and was not last committed to by
 * anybody; its files were. There is nothing to average and nothing to be missing, and
 * "not measured yet" over `web/src` under Language is the map apologising for a measurement
 * it correctly never took. A FILE has both and keeps its row, including the row that says
 * `not in git`, which IS a fact about that file.
 */
export function saysNothing(node: Node, mode: ColorMode): boolean {
  if (mode === 'traps') return node.kind !== 'func'
  if (mode === 'blame' || mode === 'language') return node.kind === 'dir'
  return false
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
        ? // `hot` was the last of the temperatures, left behind when the rows became
          // `predictable / typical / quirky / obscure`. The threshold this counts is
          // "quirky or worse", and `surprising` is the word for that on this tab.
          `${Math.round(t * 100)}% surprising`
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
      return {
        ...ramped(shareRamp(share), 'legible'),
        label: `${Math.round(share * 100)}% tangled`,
      }
    }
    const g = node.agentStale ? undefined : legibleOf(node.agent)
    if (!g) return null
    return { ...ramped(GRADE_SURPRISE[g], 'legible'), label: LEGIBLE_WORDS[g] }
  }

  if (mode === 'docs') {
    // Opacity's twin, and deliberately built the same way: both are a reader's four-step
    // grade on a function and a share of graded lines on a container.
    //
    // The one difference is the DIRECTION, and it is the whole reason the lens is worth
    // having. Every other ramp brightens toward more of what it measures; this one paints
    // the GAP, so bright is what nobody has explained. The map's invariant is not "more is
    // brighter", it is "bright is what you have to do something about" — and a Docs map
    // that glowed where the docs already are would send you to the finished half.
    // A FILE answers for its own header first. It is the only container that has one, and
    // a reader has now graded it — so averaging its functions here would report on the
    // file's contents while the lens is asking about the file's description of itself. The
    // functions inside it are still each painted by their own grade, which is the same
    // split Blame draws: a file's band is its own last author, not a mixture of its
    // functions'. A directory has no header, so it stays the share.
    if (node.kind === 'file') {
      const own = docGrade(node)
      // `header: none` rather than "covers none": the word is a rung on a ladder, and a
      // sentence built round it has to bend for the bottom one.
      if (own) return { ...ramped(DOC_GAP[own], 'docs'), label: `header: ${DOC_WORDS[own]}` }
      // A file nobody has read yet is grey, not an average of its functions. Its own header
      // is the thing this lens asks a file about, and guessing it from the contents would
      // be the map answering a question nobody put to it.
      return null
    }
    if (showsShare(node)) {
      const share = undocShare(node)
      if (share === null) return null
      const n = Math.round(share * 100)
      // LINEAR, not `shareRamp`. That curve is `min(1, share/0.25)^0.7` and its band is a
      // measured claim about HOT share, where a quarter of a directory being hot is extreme
      // and exactly one directory in tonepoet saturated. Documentation is not distributed
      // like that: half the directories in a normal repo are 40–100% undescribed, so every
      // one of them pinned to the brightest cyan and the ring stopped being a ranking —
      // which is the failure `shareRamp`'s own doc warns about, inherited by reusing its
      // constants in a place nobody measured them for. A share of files is already 0..1 on
      // its own terms and wants no curve; `0` still maps to `0`, so a fully described
      // directory reads as fine.
      return { ...ramped(share, 'docs'), label: `${n}% undescribed` }
    }
    const g = docGrade(node)
    if (!g) return null
    return { ...ramped(DOC_GAP[g], 'docs'), label: `docs: ${DOC_WORDS[g]}` }
  }

  if (mode === 'traps') {
    // Two states and an absence, not a ramp: a trap is a boolean and shading it would
    // invent degrees of danger nobody reported. Read-and-clear is drawn in the structural
    // neutral rather than left grey, because "a reader looked and found nothing" and
    // "nobody has looked" are opposite facts and this is the one lens where confusing them
    // would read as an all-clear.
    // `kind === 'func'` and not merely "has a reading": a FILE has one too, and `trap` is
    // one of the two fields `FILE_ASK` tells a reader to leave unset on it. Read as a leaf
    // it came back `no traps reported` — an all-clear over a question nobody asked, printed
    // in the same words a reader's real all-clear uses. It counts its contents instead.
    if (node.kind === 'func' && node.agent && !node.agentStale) {
      const trap = node.agent.trap === true
      const fill = trap ? 'var(--trap)' : 'var(--structure)'
      return { fill, stop: fill, ink: inkOn(fill), label: trap ? 'trap' : 'no trap reported' }
    }
    // A container gets no reading row at all — see `saysNothing`, which is where the card
    // decides to stay quiet rather than print a swatch over a value that does not exist.
    return null
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
  // Uncommitted lines are a state, never a slot — see `UNCOMMITTED`.
  if (mode === 'blame' && !isAuthor(key)) {
    return {
      fill: 'var(--unanalyzed)',
      stop: 'var(--unanalyzed)',
      ink: inkOn('var(--unanalyzed)'),
      label: 'uncommitted lines',
    }
  }
  const rank = ranks?.get(key)
  const slot = rank === undefined ? OTHER : slotColor(rank)
  return {
    fill: slot,
    stop: slot,
    ink: inkOn(slot),
    // The label names the value even when the colour is "Other", so identity is never
    // carried by colour alone — which is what makes the 14.3 CVD margin legal.
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
    // A FILE is a reading of its own under Docs — its header — so it is a row here beside
    // the functions, and the list counts what the dial above it counts. Only Docs: `legible`
    // and `trap` are never sent on a file reading (see `FILE_ASK`), and the other lenses ask
    // questions a file has no answer to.
    if (n.kind === 'file' && !outOfScope && mode === 'docs') {
      const g = docGrade(n)
      if (g) put(g, DOC_WORDS[g], heatColor(DOC_GAP[g], 'docs'), n)
      else put(UNKNOWN, 'not read yet', 'var(--unanalyzed)', n)
    }
    if (n.kind === 'func' && !outOfScope) {
      const s = n.score
      if (mode === 'legible' || mode === 'docs' || mode === 'traps') {
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
        } else if (mode === 'docs') {
          const g = docGrade(n)
          if (g) put(g, DOC_WORDS[g], heatColor(DOC_GAP[g], 'docs'), n)
          else put(UNKNOWN, 'not graded', 'var(--unanalyzed)', n)
        } else if (legibleOf(r)) {
          const g = legibleOf(r)!
          put(g, LEGIBLE_WORDS[g], heatColor(GRADE_SURPRISE[g], 'legible'), n)
        } else {
          // Covers both a reading that never graded legibility and one that graded it under
          // a question since rewritten. Deliberately one bucket: from where the reader is
          // standing they are the same fact — nobody has answered today's question about
          // this function — and splitting them would put a row on screen about our own
          // release history.
          put(UNKNOWN, 'not graded', 'var(--unanalyzed)', n)
        }
      } else if (mode === 'blame' || mode === 'language') {
        const key = mode === 'blame' ? n.lastAuthor : n.lang
        if (key && (mode !== 'blame' || isAuthor(key))) {
          const rank = ranks?.get(key)
          put(key, key, rank === undefined ? OTHER : slotColor(rank), n)
        } else if (mode === 'blame' && key) {
          // Written to but not committed. Its own row, because "these lines are yours and
          // unsaved" and "this file is not in git" are different things to be told.
          put('\u0000uncommitted', 'uncommitted lines', 'var(--unanalyzed)', n)
        } else {
          // No blame at all: untracked, a symlink, or not a repo. It was labelled
          // `uncommitted`, which is the other thing entirely.
          put(UNKNOWN, mode === 'blame' ? 'not in git' : 'unknown', 'var(--unanalyzed)', n)
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
  } else if (mode === 'legible' || mode === 'docs') {
    // Best first, calm end first, dark end first — the direction `Spread` reads in and the
    // direction each ramp's own legend reads in (`crystal → nonsense`, `covered →
    // undocumented`). It was worst-first, so the same bar meant "getting worse" left to
    // right under Surprise and "getting better" under the two lenses beside it. Nothing was
    // mis-COLOURED — bright has always been the thing to act on — but a reader moving
    // between tabs had to re-learn which way to read a row of five.
    const order: string[] = ['full', 'most', 'some', 'none']
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
    // Uncommitted lines never enter the ranking, so they cannot hold a colour slot.
    if (key && n.kind === 'func' && (mode !== 'blame' || isAuthor(key))) {
      seen.set(key, (seen.get(key) ?? 0) + n.loc)
    }
    n.children.forEach(walk)
  }
  walk(root)
  // By lines, so the legend is ordered by how much of the picture each one actually is.
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
}
