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
  trapOf,
  type Grade,
  type Node,
  type Ramp,
  HEAT_WORDS,
  type AgentReport,
} from './api'
import { inkOn } from './ink'

/** What the color in the sunburst means. One geometry, ten encodings.
 *
 *  `surprise`, `legible` and `traps` all come from a reader's report and answer three
 *  different questions about it: could you reach the intent from outside, was the body clear
 *  once open, and will it bite the next person to edit it. They are lenses rather than one
 *  blended number because they disagree — a body can be unguessable and plain, or guessable,
 *  plain, and mined. Blending them would average away the exact distinction they exist for;
 *  switching between them makes it a blink comparison.
 *
 *  `callers` and `reach` are the two that cost nothing. Every other lens here waits for
 *  something — a reader to spend tokens, or a repo to have a history — and on a codebase a
 *  model produced an hour ago there is neither. These come off the parse, so they are on
 *  screen the moment a project opens: what nothing calls, and what reaches out of its own
 *  neighbourhood. */
export type ColorMode =
  | 'surprise'
  | 'legible'
  | 'docs'
  | 'traps'
  | 'clones'
  | 'callers'
  | 'reach'
  | 'blame'
  | 'language'
  | 'churn'
  | 'age'

/**
 * The order on screen, and therefore the ⌘-digits — the switcher, its tooltips and the key
 * handler all read this one list, so there is nothing for them to drift from.
 *
 * **The right-hand end is a widening time window.** Churn is a 90-day span, age is unbounded,
 * and History — past the end of the row — is the whole timeline. Entering it is then a
 * continuation of the gesture rather than a mode change out of nowhere. Blame is a point in
 * time as well (who touched each line last), but it is drawn like Language rather than like
 * these two, and it sits with the lens it resembles rather than with the ones it neighbours
 * in meaning.
 *
 * Named for the SUBJECT, and the color carries the direction. This tab was `Opacity` for a
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
 * The FOUR lenses painted from a reader's report lead, because Surprise is what the app is
 * for and Traps is read out of the same report — three grades and a mark, contiguous, so the
 * part of the row that costs a reading is one run rather than two with the wiring in between.
 * Clones travels with Traps because the two behave alike on the map. Then the two CATEGORICAL
 * lenses sit together — Blame and Language are the pair with palette slots instead of a ramp,
 * so a reader who has just learned that colour means owner meets the other lens that works
 * the same way next — and the row closes on the widening time window: churn is ninety days,
 * age is unbounded, History is the whole story.
 */
/** What each lens can say about a PAST commit, which is not the same question as what it
 *  can say about the code in front of you.
 *
 *  **History used to be a twelfth lens and is really a second axis.** Entering a replay
 *  forced the map to `age` and greyed the whole switcher, which was a blunt instrument: a
 *  frame knows perfectly well how much churn a function had in 2019 and what language it was
 *  written in.
 *
 *  - `live` — the frame already carries it. `frameTree` folds `churn`, `ageDays`,
 *    `lastTouchedDays` and `commits` per frame, and each function node keeps its `lang`, so
 *    these paint from the frame's own numbers rather than from today's scan.
 *  - `cost` — derivable, unbuilt. Callers and Reach need the call graph resolved per frame,
 *    and resolution is repo-wide by nature: a name only resolves against every definition in
 *    the repo, so the honest version is a live index with edges retracted and re-added as
 *    files change, and then the per-frame COUNT changes have to reach the window on a delta
 *    stream that was fought down from 20.9MB to 1.0MB on ceph. Clones is cheaper than that —
 *    the parser already fingerprints every function and the fold would only have to count
 *    shapes — but it is a column on the funcs table and a `CACHE_VERSION` bump, which is a
 *    day rather than an afternoon.
 *
 *    Blame was in this list and is not any more: the frame already knew which commit last
 *    changed each function and every delta already carried its author, so the answer was
 *    sitting in the fold the whole time.
 *
 *  **There is no `never`, and there was one until somebody read the sentence it printed.**
 *  The four lenses a reading paints were classed as impossible on the rule that a reading
 *  measures the body as it stands, so stamping it onto an older commit claims a measurement
 *  nobody took. That rule is real and it is about TODAY's readings. It says nothing about the
 *  readings that existed at the commit being drawn — and `.sanity/` is committed, so those are
 *  in the history like everything else. They are folded now: `history.rs` parses each version
 *  of each shard as it walks, joins it to the interned functions by `assessment::key_of`, and
 *  puts the grades on the frame. What a replay paints under these four is what the repo KNEW
 *  about itself at that commit, and watching it fill in is the point.
 *
 *  What survives of the old rule is the thing it was written for: no frame is painted with a
 *  reading taken against a body it does not hold, and a superseded axis is dropped by
 *  `packed` at the Rust end rather than shown as current. */
export const REPLAY: Record<ColorMode, 'live' | 'cost'> = {
  surprise: 'live',
  legible: 'live',
  docs: 'live',
  traps: 'live',
  clones: 'cost',
  callers: 'cost',
  reach: 'cost',
  blame: 'live',
  language: 'live',
  churn: 'live',
  age: 'live',
}

/** Why this lens has no colours in a replay, in the words the tab and the map both use.
 *
 *  One sentence, because one reason is left. It said two for a day: a lens off the parse has
 *  to be recomputed per commit, while a lens off a reading only needed the shards folding —
 *  and saying that out loud is what got them folded. */
export function replayNote(mode: ColorMode): string | null {
  if (REPLAY[mode] === 'live') return null
  return `${MODE_LABEL[mode]} is not replayed: it would have to be recomputed at every commit, and the timeline does not carry it.`
}

export const MODE_LABEL: Record<ColorMode, string> = {
  surprise: 'Surprise',
  legible: 'Legibility',
  docs: 'Docs',
  // **The two flashpoint lenses sit next to the reading ones, and the wiring pair follows.**
  // Traps and Clones behave alike — a mark, no ramp, no roll-up, a breathing wedge — so they
  // travel together wherever they go; what moved is which side of Callers and Reach they sit
  // on. Read left to right the strip runs: what reading this code was like, then the marks
  // saying go and look at THIS, then how it is wired, then the seam, then a widening window
  // of time. The four lenses a reader's report paints are now contiguous, which is the
  // grouping somebody scanning the row is most likely to be looking for.
  traps: 'Traps',
  clones: 'Clones',
  callers: 'Callers',
  reach: 'Reach',
  blame: 'Blame',
  language: 'Language',
  churn: 'Churn',
  age: 'Age',
}

export const MODE_HINT: Record<ColorMode, string> = {
  surprise: 'what a reader didn’t see coming',
  legible: 'what reading it was actually like',
  docs: 'what nobody has explained',
  traps: 'what will bite whoever edits it next',
  callers: 'how many things call it',
  reach: 'how much it calls out to',
  clones: 'what is a clone of something else',
  language: 'what it is written in',
  blame: 'who committed to it last',
  churn: 'how much it has changed lately',
  age: 'how long since anyone touched it',
}

/** Which lenses are painted from a reader's report rather than from git or the parse.
 *
 *  They share the things that follow from that: a wedge with no reading is gray rather than
 *  colored, a stale reading is hatched because its grade describes a body that has changed,
 *  and the legend has to say so. Asking it once here stops three call sites each deciding
 *  for themselves and drifting — the stale hatch was `mode === 'surprise'` in two places and
 *  would have silently stopped marking anything under the two new lenses. */
export function paintsFromReadings(mode: ColorMode): boolean {
  return mode === 'surprise' || mode === 'legible' || mode === 'docs' || mode === 'traps'
}

/** Which lenses come off the call graph.
 *
 *  Asked once here for the same reason `paintsFromReadings` is: three call sites would each
 *  decide for themselves and the third one added would be forgotten. What follows from it is
 *  that a gray wedge means "this language's call shape has never been parsed" rather than
 *  "nobody has read this" — the legend has to say so, and the two are not the same absence. */
export function paintsFromWiring(mode: ColorMode): boolean {
  return mode === 'callers' || mode === 'reach'
}

/** How big a group has to be to earn its own row in the panel.
 *
 *  Bands and not one `copied` row, because a pair and a fourteen-way group are different
 *  findings and the second is the one worth an afternoon. They are all drawn in the SAME
 *  purple — the wedge says *this is a copy*, and how many copies is a number, which belongs
 *  in a label and in the panel's ordering rather than in a shade nobody can count. */
const CLONE_BANDS: { label: string; min: number }[] = [
  { label: '6+ clones', min: 6 },
  { label: '3–5 clones', min: 3 },
  { label: '2 clones', min: 2 },
]

/**
 * Fan-in, in the four bands the lens paints.
 *
 * **It was two states and an absence, and the two states were the problem.** A caller count
 * is a power law whose zero bucket holds 22–56% of a repo, so a five-stop ramp would have
 * spent four stops on a thin tail — that argument still holds and is why this is four bands
 * and not a continuous scale. What did not hold was painting the zero bucket at the ramp's
 * hot end: "nothing calls it" was drawn in the colour every other lens uses for *act on
 * this*, over a population that is mostly entry points, trait impls, `#[test]` functions,
 * React components and anything a framework or another language calls by string. The map was
 * asserting dead code across a repo where the honest sentence is "no in-repo caller found".
 *
 * So the ramp runs the way every other ramp here runs — brighter means MORE of the thing the
 * lens is named for — and zero sits at the quiet end. Finding orphan clusters still works,
 * because a cluster of the dimmest band in a bright neighbourhood is exactly as visible as
 * the reverse; what changed is that the picture no longer says which of the two is a fault.
 *
 * `t` is the band's position on the ramp, evenly spaced so no band is nearer another than
 * the bands are to each other.
 */
const CALLER_BANDS: { label: string; short: string; min: number; t: number }[] = [
  { label: '6+ callers', short: '6+', min: 6, t: 1 },
  { label: '2–5 callers', short: '2–5', min: 2, t: 2 / 3 },
  { label: '1 caller', short: '1', min: 1, t: 1 / 3 },
  { label: 'no in-repo caller', short: 'none', min: 0, t: 0 },
]

/** The same four bands as the legend draws them: dim end first, and named in the short form
 *  — the strip under the map has room for `none · 1 · 2–5 · 6+` and not for four sentences,
 *  and the lens it belongs to is named an inch away in the switcher. The panel and the
 *  tooltip use the long labels, where there is room to be explicit about `in-repo`. */
export const CALLER_KEY: [string, string][] = [...CALLER_BANDS]
  .reverse()
  .map((b) => [heatColor(b.t, 'callers'), b.short])

/**
 * Fan-out, in the same four bands.
 *
 * **The same shape as `CALLER_BANDS` because it is the same kind of count**, read the other
 * way down the edge: Callers is who depends on this, Reach is what this depends on. Keeping
 * the boundaries identical is what lets the two be compared by eye — a function bright under
 * both is a hub, bright under Reach alone is an orchestrator nothing has adopted, and bright
 * under Callers alone is a primitive. Different boundaries would make that reading a
 * calculation.
 */
const REACH_BANDS: { label: string; short: string; min: number; t: number }[] = [
  { label: 'calls 6+', short: '6+', min: 6, t: 1 },
  { label: 'calls 2–5', short: '2–5', min: 2, t: 2 / 3 },
  { label: 'calls 1', short: '1', min: 1, t: 1 / 3 },
  // **Not "calls nothing HERE".** `here` reads as this directory, which is a claim about
  // place — the exact misreading that made Locality unusable, reintroduced in a word. The
  // row means what the tooltip means and now says the same thing: nothing it calls resolves
  // to a definition in this repo. It may call a great deal; the stdlib, a dependency, a
  // dynamic target and another language are all invisible to the resolver by design.
  { label: 'calls nothing in this repo', short: 'none', min: 0, t: 0 },
]

export const REACH_KEY: [string, string][] = [...REACH_BANDS]
  .reverse()
  .map((b) => [heatColor(b.t, 'reach'), b.short])

/** The band a count falls in. Never called with `null`: an unresolved language is an
 *  absence, and an absence is grey rather than a band. */
/** The first band `n` reaches, which requires `bands` to run DESCENDING by `min`.
 *
 *  `find` returns the first match, so on an ascending list every number matches the smallest
 *  band and the answer is wrong for everything except the bottom rung — silently, since a band
 *  is a label and a colour rather than something with a checkable value. The three tables here
 *  are written high-to-low and a fourth must be too; this is the sentence that says so, because
 *  nothing in the type can. */
function bandOf<T extends { min: number }>(bands: T[], n: number): T {
  return bands.find((b) => n >= b.min) ?? bands[bands.length - 1]
}

/** The share of resolvable functions underneath that something in this repo calls.
 *
 *  Callers' roll-up, and the analogue of `hotShare`: the leaf is a band, the container is how
 *  much of it is up the scale. Measured across four real repos the *unreferenced* half runs
 *  22–56%, so either direction spreads across the mix without a curve — the same reason the
 *  Docs share is linear where `shareRamp` is not.
 *
 *  **Called and not unreferenced**, so the container climbs the same way the leaf does: a
 *  directory nothing calls into is the dim end, exactly like the functions inside it. It was
 *  the other way round while the leaf's zero was the hot end, which made one fact paint two
 *  directions at two levels of the tree.
 *
 *  Read off the node for the reason `wiringShare` is, and counted in Rust with the same
 *  denominator discipline: **functions whose language resolves calls**, never all functions. A
 *  directory of Fortran beside a directory of Rust would otherwise report the Fortran as
 *  referenced, which is a claim nobody measured. `null` when none of it resolves. */
function calledShare(node: Node): number | null {
  if (node.resolvable == null || node.orphans == null || node.resolvable === 0) return null
  return 1 - node.orphans / node.resolvable
}

/** The share of resolvable functions underneath that call something in this repo.
 *
 *  Reach's roll-up, and `calledShare` read down the other side of the edge. A container has
 *  no fan-out of its own to report — the counts underneath are per function and averaging
 *  them would report how many small functions a directory holds, the mistake `away / incident`
 *  was written to avoid — so what climbs the tree is the share that reaches out at all. */
function reachingShare(node: Node): number | null {
  if (node.resolvable == null || node.sinks == null || node.resolvable === 0) return null
  return 1 - node.sinks / node.resolvable
}

/**
 * Categorical palette for blame and language.
 *
 * Qualitative, not a ramp — these are names, and any sequential scale would imply an
 * order that does not exist. Chosen to stay distinguishable under the common color
 * vision deficiencies by separating on lightness as well as hue, which a rainbow does
 * not. Deliberately muted: a categorical field can fill the whole chart, and at that
 * coverage saturated colors are unreadable.
 */
/**
 * Sixteen slots, assigned by rank — biggest category first — and never cycled.
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
 * **Sixteen now, and the eight it grew from are unchanged.** A ninth hue does cost — the
 * numbers are in `index.css`, 14.4 down to 8.8 across sixteen — and the earlier note said
 * that was reason enough to stop. What changed the answer is the blame lens at repo scale:
 * ceph's `rgw` is thirty-nine authors, so eight slots painted one directory in one colour
 * and thirty-eight people in grey, and a replay made that the whole story rather than a
 * corner of it. A worst pair of 8.8 across normal vision and all three dichromacies is a
 * real colour; a shared neutral is not a colour at all.
 *
 * The nine-to-sixteen were SEARCHED the way one-to-eight were, inside the same muted band
 * and against the neutrals and marks they sit beside — not generated off a hue wheel, which
 * is the version that fails: golden-angle spacing scores 0.3 under dichromacy at this size,
 * because a wheel folds to two poles and a generator cannot see it happen.
 *
 * Everything past the sixteenth still folds into "Other" in the structural neutral, and the
 * tail is reachable by picking it in the panel instead. A seventeenth series is never an
 * invented hue.
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
  'var(--cat-9)',
  'var(--cat-10)',
  'var(--cat-11)',
  'var(--cat-12)',
  'var(--cat-13)',
  'var(--cat-14)',
  'var(--cat-15)',
  'var(--cat-16)',
  // Seventeen to sixty-four: the tail that lets a repo's people each have a colour rather
  // than a place in a top table. See `index.css` for what the well measures out to.
  'var(--cat-17)',
  'var(--cat-18)',
  'var(--cat-19)',
  'var(--cat-20)',
  'var(--cat-21)',
  'var(--cat-22)',
  'var(--cat-23)',
  'var(--cat-24)',
  'var(--cat-25)',
  'var(--cat-26)',
  'var(--cat-27)',
  'var(--cat-28)',
  'var(--cat-29)',
  'var(--cat-30)',
  'var(--cat-31)',
  'var(--cat-32)',
  'var(--cat-33)',
  'var(--cat-34)',
  'var(--cat-35)',
  'var(--cat-36)',
  'var(--cat-37)',
  'var(--cat-38)',
  'var(--cat-39)',
  'var(--cat-40)',
  'var(--cat-41)',
  'var(--cat-42)',
  'var(--cat-43)',
  'var(--cat-44)',
  'var(--cat-45)',
  'var(--cat-46)',
  'var(--cat-47)',
  'var(--cat-48)',
  'var(--cat-49)',
  'var(--cat-50)',
  'var(--cat-51)',
  'var(--cat-52)',
  'var(--cat-53)',
  'var(--cat-54)',
  'var(--cat-55)',
  'var(--cat-56)',
  'var(--cat-57)',
  'var(--cat-58)',
  'var(--cat-59)',
  'var(--cat-60)',
  'var(--cat-61)',
  'var(--cat-62)',
  'var(--cat-63)',
  'var(--cat-64)',
]
export const OTHER = 'var(--structure)'
export const OTHER_LABEL = 'other'
/**
 * The one bucket everybody past the palette's reach falls into.
 *
 * **A key of its own, because `other` is not a value and must not be spelled like one.** The
 * tail used to keep each member's own key and merely take the neutral fill, so a breakdown of
 * kibana held two hundred grey rows all called something different — and the rim, which draws
 * one segment per row, cut two hundred sub-pixel bands out of a neutral it then had to merge
 * back together at draw time. One fold, stated once, in the walk both surfaces share.
 *
 * Kept out of the namespace real keys live in for the reason `UNKNOWN` is, and written as the
 * escape for the reason `UNKNOWN` is: an author genuinely called `other` is a person.
 */
export const OTHER_KEY = '\u0000other'
/** How many categories get a color of their own. Exported because the legend has to know
 *  which ones have one — it counted to four itself once, and a legend with its own copy of
 *  the palette's size is a legend that can disagree with the map. */
export const SLOTS = CATEGORICAL.length

/** How many the legend NAMES, which stopped being the same number when the palette went to
 *  sixty-four.
 *
 *  A key is a caption: sixteen names at ceph's median author-name length is three per row and
 *  six rows, and sixty-four would be a panel standing on the map. The other forty-eight still
 *  have colours of their own — what they do not have is a place in the corner, and the way to
 *  ask who one of them is is to click the wedge. */
export const NAMED = 16

/** The two ends of a ramped lens, in the words the key prints under it.
 *
 *  Exported because a movie needs the same words: an export burns its own key into the
 *  caption column, and a second table there would be a second vocabulary — the failure this
 *  one already had, when the key read `clear → unclear` while the rows beneath it said
 *  something else. One table, two surfaces. */
export const RAMP_ENDS: Partial<Record<ColorMode, [string, string]>> = {
  surprise: ['mundane', 'obscure'],
  // Same direction as heat: the bright end is the one you have to do something about.
  legible: ['clean', 'unclear'],
  // Named for the ends the ramp actually paints, and the bright one is an absence: this is
  // the only lens whose input is the GAP. See the `--docs-*` ramp.
  docs: ['covered', 'undocumented'],
  churn: ['settled', 'churning'],
  age: ['old', 'recent'],
}

/** Which ramp a lens walks, for anything drawing a key beside it.
 *
 *  The swatch has to walk the SAME ramp the wedges do, now that each reading owns a hue —
 *  otherwise the key under a blue map is an amber gradient. */
export function rampOf(mode: ColorMode): Ramp {
  if (mode === 'churn') return 'churn'
  if (mode === 'age') return 'age'
  if (mode === 'legible') return 'legible'
  if (mode === 'docs') return 'docs'
  return 'heat'
}

/** The one colour that stands for a lens, as a custom-property name.
 *
 *  **Stop 3 rather than stop 4 for the ramped lenses.** The hot end is the loudest colour in
 *  the app and it is spent on the wedges that need it; a chip wearing it competes with the
 *  map it is labelling. One stop down is the same hue and reads as chrome.
 *
 *  Blame and Language have nothing on the map to quote — their wedges come out of the
 *  categorical palette, and one slot out of it would paint the lens in whichever author
 *  sorted first. They get a colour of their own instead, spent on the chrome only; see
 *  `--lens-blame` in index.css for where the two hues come from. */
export function modeToken(mode: ColorMode): string {
  if (mode === 'traps') return '--trap'
  if (mode === 'clones') return '--clone'
  if (mode === 'callers') return '--callers-3'
  if (mode === 'reach') return '--reach-3'
  if (mode === 'blame') return '--lens-blame'
  if (mode === 'language') return '--lens-language'
  return `--${rampOf(mode)}-3`
}

/** The name git puts on a line that is in the working tree and not in a commit.
 *
 *  It arrives as an author string and it is not an author: it is a STATE, and treating it
 *  as a person cost this map twice over. It sorted second by lines in a repo mid-session
 *  and took `--cat-2`, so one of eight measured color slots went to a non-person and a
 *  real author was pushed toward "Other" — while the legend listed it among people. Now it
 *  is an absence, like a file with no blame at all, and the two say which they are. */
const UNCOMMITTED = 'Not Committed Yet'

/** Neither an author nor a language: a fact about git's view of the line, not about who
 *  wrote it. Both are drawn in the unanalyzed neutral and named for what they are. */
export function isAuthor(key: string | null): key is string {
  return key !== null && key !== UNCOMMITTED
}

/**
 * Rank → colour, recycling into the UNNAMED slots once the palette runs out.
 *
 * **Past the palette everything used to be `OTHER`, and one flat neutral is a worse claim
 * than a repeated colour.** On kibana's root that block was sixty-one people, drawn as a
 * single band that reads as one owner called Other — so the rim could not tell a directory
 * one person wrote from a directory thirty people wrote, which is the reading it exists to
 * give. It was not a size problem: there is room for those segments, and the reason they
 * were merged was that the palette had nothing left to give them.
 *
 * **Recycling is safe here for one reason and it is not the obvious one.** The tempting rule
 * is to share a colour between people whose ACTIVE PERIODS do not overlap — an early
 * contributor and a late one can surely wear the same shade. They cannot: blame is about
 * lines, and lines outlive their authors. Somebody who stopped committing in 2014 owns code
 * on today's map beside somebody who started last month, so the conflict graph is near
 * complete and there is no schedule to exploit. It is also the family of rule this map has
 * already rejected three times — see the replay's palette note, where ranking per frame
 * recoloured the cast, seeding from today greyed the opening, and assigning by arrival
 * greyed the ending.
 *
 * What makes it safe instead is that a recycled colour is never a NAMED one. The legend
 * claims the first `NAMED` slots and nothing else, so a collision is always between two
 * people the key does not identify — people who were both grey a moment ago. The distinction
 * given up was never held; what is gained is that a crowd looks like a crowd.
 *
 * Stable across a replay by construction: this is a pure function of a ranking computed once
 * over the whole log, so a person's colour does not move as the story runs.
 *
 * **All of the above is the DEFAULT, and it is now a default rather than a rule.** A reader
 * who wants the tail merged says so with the color cap and gets one neutral `other` — which
 * is the arrangement this note rejects, correctly, as an answer for everybody. See `CAPS`.
 */
export function slotColor(rank: number): string {
  if (rank < CATEGORICAL.length) return CATEGORICAL[rank]
  const span = CATEGORICAL.length - NAMED
  return CATEGORICAL[NAMED + ((rank - CATEGORICAL.length) % span)]
}

/** Whether this rank is wearing a shade somebody else is also wearing — see `slotColor`.
 *  The legend says so once rather than every segment carrying a mark. */
export function shared(rank: number): boolean {
  return rank >= CATEGORICAL.length
}

/**
 * How many categories get a color of their own — the reader's choice, not a constant.
 *
 * **This is the number the palette notes above have been arguing about since it was four,
 * and the argument was never settleable because it has two right answers.** Somebody
 * studying who owns a codebase wants eight colors and a tail called `other`: the picture
 * then says "these are the major contributors and everything else", which is a claim they
 * can act on. Somebody looking at the SHAPE of a four-hundred-author repo wants every one of
 * them colored, knows the result is confetti, and is asking for confetti — a crowd that
 * looks like a crowd is the reading. Neither is wrong and no constant serves both, which is
 * why every move of the constant fixed one repo and broke another.
 *
 * So it is a control, on `lib/rings.ts`'s own test for whether something should be: the
 * reader can see the consequence immediately, in the picture, and decide. `Infinity` is the
 * default and is exactly what shipped before this existed — the full palette with recycling
 * past it — so nothing moves until somebody asks it to.
 *
 * **This does not reverse `slotColor`'s note; it settles it.** That note rejected folding the
 * tail into one neutral, on the ground that a repeated color says more than a shared grey.
 * Still true, and still the default. What it could not say is that the reader might be asking
 * the OTHER question, where the tail is precisely the part they want merged and named as
 * merged. The cap is how they say which.
 *
 * The steps stop at 64 because that is the palette — past it `slotColor` recycles, and a step
 * called 128 would be a control offering colors that do not exist. `Infinity` is named `all`
 * for the same reason: it is honest about being a rule rather than a count.
 */
export const CAPS = [4, 8, 16, 32, 64, Infinity] as const
export const CAP_DEFAULT = Infinity

/**
 * The ranking with everyone past `cap` dropped.
 *
 * **Applied to the RANKS rather than threaded through the six places that read them.** Every
 * surface here already agrees on one rule — an unranked category is `other` — so removing an
 * entry is the whole of what a cap has to do: the wedge greys, `contribute` folds it into
 * `OTHER_KEY`, the legend counts it in its neutral row, and the movie key inherits all three.
 * A `cap` parameter on `colorFor`, `contribute`, `bucketsFor`, `histogramsFor`, `legendFor`
 * and `keyFor` would be six chances for one of them to be handed a different number.
 *
 * A pure function of the ranking, so a replay is as stable under a cap as without one: a
 * person's color still cannot move as the story runs, and the tail they fall into is the
 * same tail in every frame.
 */
export function capRanks(
  ranks: Map<string, number> | undefined,
  cap: number,
): Map<string, number> | undefined {
  if (!ranks || !Number.isFinite(cap)) return ranks
  if (ranks.size <= cap) return ranks
  const m = new Map<string, number>()
  for (const [k, r] of ranks) if (r < cap) m.set(k, r)
  return m
}

/** One of a replay's two flashes: the token, flat, for as long as the flash lasts.
 *
 *  **Flat is the third answer here and the first one that worked.** It was a decaying mix
 *  toward the ground, then a decaying mix with the quieter event held under a ceiling, and
 *  both spent most of their life in colours nobody chose. Worse, `color-mix(in oklch, …)`
 *  interpolates HUE along the shorter arc, so a partial mix of the flash colour with the
 *  warm grey ground toured the wheel between them: the cyan arrival that shipped before
 *  this went visibly GREEN on the way out, which read as a third event. `in oklab` fixes
 *  that much — no hue axis to travel — but the mix earned its place back only if a partial
 *  volume is wanted at all, and it is not. An event is on or it is over. */
function flash(token: string, label: string): Paint & { label: string } {
  return { fill: `var(${token})`, stop: token, ink: inkOn(token), label }
}

/** The same two flashes, for a wedge that is showing an event it does not itself carry.
 *
 *  A replay's event belongs to a function, and on a large repo neither the function nor
 *  its file has a wedge on screen — so the nearest thing that IS drawn shows it instead,
 *  which the renderer works out and this hands it the paint for. It is deliberately the
 *  identical colour and not a diluted one: what escalated is where the event could be
 *  DRAWN, not how certain we are that it happened. */
export function flashPaint(kind: 'birth' | 'touch'): Paint & { label: string } {
  return kind === 'birth' ? flash('--birth', 'new') : flash('--touch', 'changed')
}

/** A ramped fill, the stop it sits nearest, and the ink that survives on it. The three
 *  move together and always have to: a caller that took the fill without the ink is how
 *  every label in the map came to be one color over a ramp spanning 6:1 of lightness.
 *  See `ink.ts`. */
function ramped(v: number, ramp: Ramp = 'heat'): Paint {
  const stop = rampStop(v, ramp)
  return { fill: heatColor(v, ramp), stop, ink: inkOn(stop) }
}

/** What the ramp spans for a caller that has a node but not the tree it came from. A
 *  year, which is what the scale was fixed at before it was normalized. */
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
 *  Normalizing costs something real and it is worth saying out loud: a green wedge here and
 *  a green wedge in a ten-year-old repo are no longer the same fact. That is already true of
 *  every other lens on this map — surprise is calibrated per repo, churn is a share of a
 *  window, blame slots are ranked within one project — and a color that means "old FOR
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
 * `null` when nothing under it has been read, which the caller paints gray. Absence stated,
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
 *  rule `reportGrades` applies to the number, applied here to the color, because a lens
 *  that disagreed with the breakdown beside it would be two answers to one question. */
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
 * `null` when nothing underneath has been graded, which the caller paints gray — absence
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
 * yet` is a fact about a function nobody has read, and dropping it would let gray pass for
 * cold. That rule needs an exception exactly where the absence is not a fact about the code
 * but about the QUESTION.
 *
 * Traps over a container is the case. A trap is one boolean a reader reported against one
 * body; a directory has no body and was never asked, so there is no reading to be missing.
 * A count of the ones underneath was tried and read worse: `16 traps` beside a neutral
 * swatch describes a color nothing on screen is wearing, and it puts a roll-up in the one
 * slot on this card reserved for what the wedge itself is. The panel lists the sixteen by
 * name, which is what you would do with them anyway.
 *
 * Blame and Language over a DIRECTORY are the same shape and were missed with it. Both are
 * categorical — a directory is not written in a language and was not last committed to by
 * anybody; its files were. There is nothing to average and nothing to be missing, and
 * "not measured yet" over `web/src` under Language is the map apologizing for a measurement
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
 * The color for one wedge under one mode, plus what to say about it.
 *
 * Returns null when the mode has nothing to say for this node — no history, no language,
 * nothing analyzed. The caller paints those with the structural neutral rather than
 * inventing a value, which is the same rule the whole app follows: absence is stated,
 * never filled in.
 */
export function colorFor(
  node: Node,
  mode: ColorMode,
  ranks?: Map<string, number>,
  /** The repo's own span for the age ramp, from `ageSpanOf(root)`. Optional because a
   *  caller that has a node but not the tree it came from should still get a color —
   *  it falls back to the floor, which is the old fixed scale's short end. */
  ageSpan?: number,
): (Paint & { label: string }) | null {
  const s = node.score

  // **The events come first, and then the lens paints — if it is one a frame can paint.**
  // This used to end the story: a replay was grey whatever the switcher said, on the rule
  // that a frame's score carries no reading and no scale worth drawing. What the frame does
  // carry is the point — `frameTree` folds `churn`, `ageDays` and `lastTouchedDays` per frame
  // and keeps each function's `lang`, so those lenses have real numbers for the commit under
  // the playhead and were being thrown away. What it does not carry is everything else, which
  // is a fact about the fold rather than about the question — see `REPLAY`.
  //
  // A wedge still flashes on the commit it first appears in, fades over `flashWindow`, and
  // then — instead of sitting at the ground — takes whatever colour the lens gives it in
  // that frame. The flash outranks the lens because it is the thing that just happened.
  if (s?.provenance === 'history') {
    // Arrival first, and it is not a tie-break so much as the whole point: the commit that
    // creates a function also touches it, so a wedge that has just been born qualifies for
    // both and must show the loud one.
    if (s.appeared != null) return flash('--birth', 'new')
    // Full strength, like the arrival. The two are ranked by their colours — a deep green
    // against a near-yellow lime — rather than by diluting this one toward the ground,
    // which was tried at 45% and then 55% and produced an event nobody could see.
    if (s.edited != null) return flash('--touch', 'changed')
    // Not this lens, not in a replay: the wedge stays at the ground and the map says why —
    // see `LensGap`. Falling through instead would paint a past commit with today's answer.
    if (REPLAY[mode] !== 'live') return null
  }

  if (mode === 'surprise') {
    if (!s || !isAnalyzed(node)) return null
    const share = showsShare(node)
    const t = share ? s.hotShare : s.surprise
    // The fill is calibrated and the label is not, and that split is the whole point:
    // `shareRamp` decides where 9% lands on the color bar, the label says 9%. Ramping
    // the printed number too would report the calibration as if it were the reading.
    // A function a reader read is named, not numbered — its scale has four steps and a
    // printed 62 claims otherwise. A container keeps its percentage: that one is a
    // roll-up of many readings in surprise space, where every digit is earned.
    return {
      ...ramped(share ? shareRamp(t) : t),
      label: share
        ? // `hot` was the last of the temperatures, left behind when the rows became
          // `mundane / typical / quirky / obscure`. The threshold this counts is
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
    // rings gray also threw away the one thing the map can say that a list cannot, which is
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
      // A file nobody has read yet is gray, not an average of its functions. Its own header
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
      // one of them pinned to the ramp's brightest stop and the ring stopped being a ranking —
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
    // neutral rather than left gray, because "a reader looked and found nothing" and
    // "nobody has looked" are opposite facts and this is the one lens where confusing them
    // would read as an all-clear.
    // `kind === 'func'` and not merely "has a reading": a FILE has one too, and `trap` is
    // one of the two fields `FILE_ASK` tells a reader to leave unset on it. Read as a leaf
    // it came back `no traps reported` — an all-clear over a question nobody asked, printed
    // in the same words a reader's real all-clear uses. It counts its contents instead.
    // A reading whose trap answer predates the current question is treated as no answer at
    // all, on the same rule the legible lens follows — and it matters more here, because the
    // other reading of a dated answer is `no trap reported`, which is an all-clear. Grey
    // says nobody has looked under today's question, which is what happened.
    if (node.kind === 'func' && node.agent && !node.agentStale && !node.agent.trapDated) {
      const trap = trapOf(node.agent)
      const fill = trap ? 'var(--trap)' : 'var(--structure)'
      return { fill, stop: fill, ink: inkOn(fill), label: trap ? 'trap' : 'no trap reported' }
    }
    // A container gets no reading row at all — see `saysNothing`, which is where the card
    // decides to stay quiet rather than print a swatch over a value that does not exist.
    return null
  }

  if (mode === 'callers') {
    if (showsShare(node)) {
      const share = calledShare(node)
      if (share === null) return null
      return { ...ramped(share, 'callers'), label: `${Math.round(share * 100)}% called` }
    }
    // Bands, not a scale and not two states — see `CALLER_BANDS`.
    if (node.callers == null) return null
    // The exact count on the wedge, the band in the key: "no in-repo caller" and "1 caller"
    // are different situations and the tooltip is where that fits. **"No in-repo caller"
    // rather than "nothing calls it"** — the resolver does not cross a language family, does
    // not follow dynamic dispatch and never sees a test harness, so the second sentence is a
    // claim about the world made from evidence about this repo.
    return {
      ...ramped(bandOf(CALLER_BANDS, node.callers).t, 'callers'),
      label:
        node.callers === 0
          ? 'no in-repo caller'
          : `${node.callers} caller${node.callers === 1 ? '' : 's'}`,
    }
  }

  if (mode === 'reach') {
    if (showsShare(node)) {
      const share = reachingShare(node)
      if (share === null) return null
      return { ...ramped(share, 'reach'), label: `${Math.round(share * 100)}% call out` }
    }
    if (node.calls == null) return null
    return {
      ...ramped(bandOf(REACH_BANDS, node.calls).t, 'reach'),
      label:
        node.calls === 0
          ? 'calls nothing in this repo'
          : `calls ${node.calls} function${node.calls === 1 ? '' : 's'}`,
    }
  }

  if (mode === 'clones') {
    // **A container says nothing here, exactly as it does under Traps.** A clone is a
    // flashpoint: one body, findable, checkable. It is not a quantity, so it does not
    // accumulate, and a directory tinted by its share was answering a question the lens does
    // not ask — "how cloned is this region" — in the visual language of the ones that do.
    //
    // It was built, and it is worth recording what it cost before somebody rebuilds it. The
    // mix ran `in oklch`, which interpolates HUE along the shorter arc: `--clone` sits at
    // H 308 and the neutral at H 81, 133° apart the short way round through RED. Every
    // partly-copied file came out apricot and a half-copied one came out pink, so the whole
    // map read as though it had a warm lens nobody had chosen. `in oklab` fixed the colour —
    // see `flash` above, where a cyan flash mixed toward the ground went visibly GREEN for
    // the same reason — and fixing it is what made the real problem visible: even correct,
    // the tint was a share where the lens has only marks.
    if (showsShare(node)) return null
    // Grey is "not compared", never "unique" — a body under the token floor was never
    // measured, and saying it has no copy would be the map answering a question nobody
    // asked of it. See `MIN_SHAPE_TOKENS`.
    if (node.comparable == null) return null
    if (node.cloneSize == null) {
      return {
        fill: 'var(--structure)',
        stop: 'var(--structure)',
        ink: inkOn('var(--structure)'),
        label: 'no clone in this repo',
      }
    }
    return {
      fill: 'var(--clone)',
      stop: 'var(--clone)',
      ink: inkOn('var(--clone)'),
      label: `1 of ${node.cloneSize} clones`,
    }
  }

  if (mode === 'churn') {
    if (!s || s.ageDays === null) return null
    return {
      ...ramped(s.churn, 'churn'),
      // **One ramp, two quantities, and the label is the only thing that says which.** A
      // file's is commits in the 90-day window; a function's is how many distinct commits
      // its current lines trace back to, because blame is all a per-function answer can be
      // built from — see `blame.rs`. The wedge said `27 commits in 90d` about a range whose
      // file had two.
      label:
        node.kind === 'func'
          ? `traces to ${s.commits} ${s.commits === 1 ? 'commit' : 'commits'}`
          : s.commits > 0
            ? `${s.commits} commits in 90d`
            : 'untouched in 90d',
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
    // The label names the value even when the color is "Other", so identity is never
    // carried by color alone — which is what makes the 14.3 CVD margin legal.
    label: key,
  }
}

/** Category → slot index, biggest first by lines. Computed once per scan so every wedge
 *  and the legend agree, and so a color follows the entity rather than its position on
 *  screen. */
export function rankCategories(root: Node, mode: ColorMode): Map<string, number> {
  const m = new Map<string, number>()
  legendFor(root, mode).forEach((name, i) => m.set(name, i))
  return m
}

/** One row of the panel's breakdown: a slice of the picture, its color, and its members. */
export interface Bucket {
  key: string
  label: string
  fill: string
  /** The functions in it that there is a NODE for, so the row can put them in a list.
   *
   *  Short of `count` wherever the window has not been sent a file's functions — those are
   *  spoken for by `Node.cols` and `Node.pending`, which carry a line count and a value but
   *  no function to point at. See `put` in `bucketsFor`. */
  nodes: Node[]
  /** How many functions are in it, listable or not. This is the number a row shows: it is
   *  the answer to "how many", where `nodes.length` is the answer to "how many can I be
   *  shown", and the two were one field until a bucket could hold code the window has not
   *  been handed. */
  count: number
  lines: number
}

/**
 * What Age and Churn call a function they have no git for.
 *
 * **It said `no git history`, which is a claim about the REPO made from a per-function
 * null.** On ceph — 123,000 commits, the log open in the panel beside it — 94% of `src`
 * drew as a repo with no git in it. The two absences are opposite statements and the app
 * already knows the difference: `locks` in `App.tsx` asks whether the trace has been read
 * BEFORE it says a folder has no history, with a comment saying exactly why that order
 * matters. A band that hardcodes the second one contradicts the lens's own explanation and
 * the header above it at the same time.
 *
 * So the band stops making a repo-level claim at all. What is true of the band is that this
 * map does not carry history for these lines — whether nobody has traced the repo, or the
 * tree in the window predates the trace, or there is genuinely no git — and WHICH of those
 * belongs where the app already puts it: once, on the lens, in a sentence with the button
 * that answers it. Repeating a guess at the cause on every segment is how the map came to
 * disagree with its own sidebar.
 *
 * `withoutHistory` on `ScanStats` is the field that means the repo-level fact. It is still
 * unwired, and this is deliberately NOT the place to wire it: it would take a sixth
 * parameter through `contribute`, `bucketsFor` and `histogramsFor` to say something the
 * lens says better one surface up.
 */
const NO_HISTORY = 'history not read'

/** Churn bands, in the order the panel lists them — busiest first, because that is the end
 *  of this ramp anyone opens the mode to find. Upper bound is exclusive.
 *
 *  **Unwindowed wording, because the members are functions.** These bucket `Score.commits`,
 *  which on a function is the commits its lines trace back to and not a 90-day rate — the
 *  bottom band read `untouched in 90d` over code whose lines every one of them came from a
 *  commit. What a band can honestly say is how many, not when. */
const CHURN_BANDS: { label: string; min: number }[] = [
  { label: '10+ commits', min: 10 },
  { label: '3–9 commits', min: 3 },
  { label: '1–2 commits', min: 1 },
  { label: 'no commits found', min: 0 },
]

/** Locality bands, most-remote first — the end anybody opens this lens to find.
 *
 *  Four rather than deciles, and bounded by what the distribution actually looks like. Measured
 *  across four real repos the shape is bimodal: a large mass whose wiring never leaves its own
 *  directory, a real second mass whose wiring entirely does, and a thin middle that is mostly
 *  the arithmetic of small denominators (one edge in, one out, exactly a half). Ten equal
 *  slices of that is two full buckets and eight rounding artefacts. */
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

/** One node's own contribution to a breakdown, reported through `put`.
 *
 *  **Extracted so that a breakdown of one subtree and a breakdown of every subtree are the
 *  same arithmetic.** `bucketsFor` accumulates these over a walk to answer for the pane;
 *  `histogramsFor` accumulates the identical calls bottom-up to answer for every directory
 *  on the map at once. Two walks over one rule, rather than two rules — the map and the
 *  panel are describing the same population and a second implementation is how they would
 *  come to disagree about it.
 *
 *  `outOfScope` is passed rather than derived: exclusion is inherited down the tree, and a
 *  node cannot see whether an ancestor put it out of scope. */
type Put = (key: string, label: string, fill: string, n: Node, ramp?: number) => void

/** The bucket key for "no author" / "no language", kept out of the namespace real keys
 *  live in: an author genuinely called `unknown` must not land in the absence row.
 *
 *  Written as the ESCAPE, never as a literal NUL. It was a literal one, which made this
 *  file BINARY to every tool that samples for a zero byte — `grep` and `rg` matched
 *  nothing in it and said so only if asked, `git diff` refused to show it, and one editor
 *  round-trip would have dropped the byte and folded the absence row into a real category
 *  with nothing failing. Identical at runtime, legible in the source. */
const UNKNOWN = '\u0000unknown'

function contribute(
  n: Node,
  outOfScope: boolean,
  mode: ColorMode,
  ranks: Map<string, number> | undefined,
  span: number,
  put: Put,
): void {
  // **A roll-up stand-in is a COUNT, and a count is not a member of a distribution.**
  //
  // `aggregate` already skips these — "rolled into their parent they would dilute its real
  // numbers with zeroes" — and this is the same node meeting the same argument one surface
  // over. It was not skipped here, and under a REPLAY that is most of the picture: a frame
  // folds every function too thin to draw into one stand-in per file (`history.ts`'s
  // `standIn`), which carries their combined LINES and, by design, no reading at all. Every
  // one of them landed in the absence bucket.
  //
  // So ceph's last frame drew as 94% `no git history` — 890,200 lines of it — while the same
  // repo with the replay closed was fully coloured, and while the panel beside it listed
  // 90,878 functions with ages. It got worse the further the story ran, because the later the
  // frame the more functions there are to fold, which is exactly backwards from a bug about
  // missing history and is what makes it read as a data problem rather than a drawing one.
  //
  // The lines are not counted in some other bucket instead: a stand-in has no value to put
  // anywhere, and `no history for these lines` is false — the history exists, the frame just
  // did not materialise the functions holding it. What the roll-up knows is its count, and
  // that is on the wedge's own card. `rest` is the marker because nothing but a roll-up ever
  // carries one: the backend never sets it, and the layout's own are minted after this walk.
  if (n.rest !== undefined) return
  // A FILE is a reading of its own under Docs — its header — so it is a row here beside
  // the functions, and the buckets count what the list under them counts. Only Docs:
  // `legible` and `trap` are never sent on a file reading (see `FILE_ASK`), and the other
  // lenses ask questions a file has no answer to.
  // A file stands in for its own functions when they have not arrived — see `legendFor`,
  // which ranks the colours this fills in. Only where a file has an answer of its own:
  // its author and its language are its own, while a grade is its functions'.
  if (
    n.kind === 'file' &&
    !outOfScope &&
    n.funcs > 0 &&
    (mode === 'blame' || mode === 'language')
  ) {
    // The same three cases the function branch below spells out, and deliberately the
    // same words: a row must not depend on whether the ring happened to be fetched.
    const key = mode === 'blame' ? n.lastAuthor : n.lang
    if (key && (mode !== 'blame' || isAuthor(key))) {
      const rank = ranks?.get(key)
      // Past the cap there is no rank, and everyone there is ONE row in the structural
      // neutral rather than a row apiece wearing it — see `OTHER_KEY`.
      if (rank === undefined) put(OTHER_KEY, OTHER_LABEL, OTHER, n)
      else put(key, key, slotColor(rank), n)
    } else if (mode === 'blame' && key) {
      put('\u0000uncommitted', 'uncommitted lines', 'var(--unanalyzed)', n)
    } else {
      put(UNKNOWN, mode === 'blame' ? 'no blame' : 'no language', 'var(--unanalyzed)', n)
    }
  }
  if (n.kind === 'file' && !outOfScope && mode === 'docs') {
    const g = docGrade(n)
    if (g) put(g, DOC_WORDS[g], heatColor(DOC_GAP[g], 'docs'), n)
    else put(UNKNOWN, 'not read yet', 'var(--unanalyzed)', n)
  }
  if (n.kind === 'func' && !outOfScope) {
    const s = n.score
    if (mode === 'surprise') {
      // **`Spread`'s own terms, because `Spread` is what this has to match.** The Surprise
      // pane is the one breakdown that does not come from here — it is counted in
      // `summarize`, by function rather than by line, because its rows are lists somebody
      // clicks. So the rim reproduces its categories, its colours and its order, and
      // differs from it in one stated way: the segments are LINES, like every other rim,
      // because a wedge's width is lines and a bar inside it measured in something else
      // would be two units in one shape.
      //
      // `predicted` falls back to the boolean it replaced, the same fallback `summarize`
      // makes, so a reading banked before the grades still lands somewhere real.
      if (n.agentStale) {
        put('\u0000expired', 'expired', 'var(--unanalyzed)', n)
      } else if (n.agent) {
        const g = n.agent.predicted ?? (n.agent.surprised ? 'none' : 'full')
        put(g, HEAT_WORDS[g], heatColor(GRADE_SURPRISE[g]), n)
      } else {
        put(UNKNOWN, 'unread', 'var(--structure)', n)
      }
    } else if (mode === 'legible' || mode === 'docs' || mode === 'traps') {
      // Both are read straight off the reading, so both share one absence: a function
      // nobody has read yet. It is a bucket rather than a drop, for the same reason the
      // map grays it rather than hiding it — a breakdown that silently omits the unread
      // reports a coverage it has not got.
      const r = n.agent && !n.agentStale ? n.agent : undefined
      if (!r) {
        put(UNKNOWN, 'not read yet', 'var(--unanalyzed)', n)
      } else if (mode === 'traps') {
        // A dated answer falls in with the unread, one bucket, for the reason the legible
        // branch below gives: from where the reader stands they are the same fact.
        if (r.trapDated) {
          put(UNKNOWN, 'not read yet', 'var(--unanalyzed)', n)
        } else {
          const trap = trapOf(r)
          put(
            trap ? 'trap' : 'clear',
            trap ? 'trap' : 'no trap reported',
            trap ? 'var(--trap)' : 'var(--structure)',
            n,
          )
        }
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
    } else if (mode === 'callers') {
      // The map's own bands and its absence — a panel that grouped by anything else would
      // be a legend disagreeing with the picture it sits beside. The exact count is on the
      // ROW, where it adds what the heading cannot.
      if (n.callers == null) {
        put(UNKNOWN, 'calls not resolved here', 'var(--unanalyzed)', n)
      } else {
        const band = bandOf(CALLER_BANDS, n.callers)
        put(band.label, band.label, heatColor(band.t, 'callers'), n)
      }
    } else if (mode === 'clones') {
      if (n.comparable == null) {
        put(UNKNOWN, 'too small to compare', 'var(--unanalyzed)', n)
      } else if (n.cloneSize == null) {
        put('unique', 'no clone in this repo', 'var(--structure)', n)
      } else {
        const band = bandOf(CLONE_BANDS, n.cloneSize)
        put(band.label, band.label, 'var(--clone)', n)
      }
    } else if (mode === 'reach') {
      // The map's bands and its absence, the same shape Callers takes — see `REACH_BANDS`.
      if (n.calls == null) {
        put(UNKNOWN, 'calls not resolved here', 'var(--unanalyzed)', n)
      } else {
        const band = bandOf(REACH_BANDS, n.calls)
        put(band.label, band.label, heatColor(band.t, 'reach'), n)
      }
    } else if (mode === 'blame' || mode === 'language') {
      const key = mode === 'blame' ? n.lastAuthor : n.lang
      if (key && (mode !== 'blame' || isAuthor(key))) {
        const rank = ranks?.get(key)
        // Past the cap there is no rank, and everyone there is ONE row in the structural
        // neutral rather than a row apiece wearing it — see `OTHER_KEY`.
        if (rank === undefined) put(OTHER_KEY, OTHER_LABEL, OTHER, n)
        else put(key, key, slotColor(rank), n)
      } else if (mode === 'blame' && key) {
        // Written to but not committed. Its own row, because "these lines are yours and
        // unsaved" and "this file is not in git" are different things to be told.
        put('\u0000uncommitted', 'uncommitted lines', 'var(--unanalyzed)', n)
      } else {
        // No blame at all: untracked, a symlink, or not a repo. It was labeled
        // `uncommitted`, which is the other thing entirely.
        put(UNKNOWN, mode === 'blame' ? 'not in git' : 'unknown', 'var(--unanalyzed)', n)
      }
    } else if (mode === 'churn') {
      // Same gate `colorFor` uses, so a wedge the map left gray is not given a band here.
      if (s && s.ageDays !== null) {
        const band =
          CHURN_BANDS.find((b) => s.commits >= b.min) ?? CHURN_BANDS[CHURN_BANDS.length - 1]
        put(band.label, band.label, '', n, s.churn)
      } else {
        put(UNKNOWN, NO_HISTORY, 'var(--unanalyzed)', n)
      }
    } else {
      if (s && s.lastTouchedDays !== null) {
        const d = s.lastTouchedDays
        const band = AGE_BANDS.find((b) => d < b.under) ?? AGE_BANDS[AGE_BANDS.length - 1]
        put(band.label, band.label, '', n, ageRamp(d, span))
      } else {
        put(UNKNOWN, NO_HISTORY, 'var(--unanalyzed)', n)
      }
    }
  }
}

/** A file's columnised functions, put through the same `contribute` the real ones take.
 *
 *  **One bucketing implementation, not two.** The columns exist so that a file whose ring
 *  has not been fetched can still say what is inside it, and the way that stays honest is
 *  for both paths to end in the same branch of the same function — a file with its ring
 *  and a file without one cannot then disagree about which band a number falls in, and
 *  adding a lens does not mean remembering to teach a second place about it.
 *
 *  The stand-in node is allocated ONCE and mutated per column entry. `contribute` reads
 *  it and never keeps it, so nothing outlives the call; kibana has 148,000 functions and
 *  a fresh object apiece, per lens change, is the kind of allocation this codebase has
 *  already paid for once in the frame pool. */
function contributeCols(
  file: Node,
  mode: ColorMode,
  ranks: Map<string, number> | undefined,
  span: number,
  put: Put,
): void {
  // **Only the lenses the columns can actually answer.**
  //
  // A stand-in carries numbers and nothing else, so under Blame or Language every one falls
  // to the absence bucket — and the file has ALREADY answered those for itself, out of its
  // own `lastAuthor` and `lang`. Run unguarded it doubled every directory: the real 300
  // lines by author, plus 300 more of `unknown`. The reading lenses are out for the opposite
  // reason — there is nothing in a column to answer them with, and an absence bucket would
  // report a read repo as unread.
  if (
    mode !== 'churn' &&
    mode !== 'age' &&
    mode !== 'callers' &&
    mode !== 'reach' &&
    // Clones draws DOTS on the map rather than a rim, so `histogramsFor` never asks — but
    // the pane's breakdown is `bucketsFor`, and on a repo with no rings fetched it had
    // nothing to list at all. The columns carry the clone group size, so it can.
    mode !== 'clones'
  )
    return
  const c = file.cols
  if (!c) return
  const stand: {
    /** Never listed, only counted — see `put` in `bucketsFor`. */
    synthetic: true
    kind: 'func'
    loc: number
    score?: { commits: number; ageDays: number | null; lastTouchedDays: number | null }
    callers?: number
    calls?: number
    cloneSize?: number
    comparable?: number
    agent?: undefined
    children: Node[]
  } = { synthetic: true, kind: 'func', loc: 0, children: [] }
  for (let i = 0; i < c.loc.length; i++) {
    stand.loc = c.loc[i]
    // `-1` is the absence every column encodes, and each lens already has a branch for it:
    // no history, calls never parsed, a body never compared. Restoring it as `undefined`
    // rather than as a zero is the whole point of the sentinel.
    stand.score =
      c.commits[i] < 0 && c.touched[i] < 0
        ? undefined
        : {
            commits: Math.max(0, c.commits[i]),
            // `ageDays` is the gate `contribute` checks for "this repo has history", and
            // its VALUE is unused there — the bands read `commits` and `lastTouchedDays`.
            ageDays: 0,
            lastTouchedDays: c.touched[i] < 0 ? null : c.touched[i],
          }
    stand.callers = c.callers[i] < 0 ? undefined : c.callers[i]
    stand.calls = c.calls[i] < 0 ? undefined : c.calls[i]
    stand.comparable = c.clones[i] < 0 ? undefined : 1
    stand.cloneSize = c.clones[i] > 0 ? c.clones[i] : undefined
    contribute(stand as unknown as Node, false, mode, ranks, span, put)
  }
}

/**
 * A file's held readings, put through the same `contribute` its functions would take.
 *
 * The twin of `contributeCols`, for the half of the lenses a column cannot answer: a grade
 * is not a number the scan knows. What makes it honest is the two fields the backend stamps
 * — `loc`, so the bar is weighted in lines like every other, and `stale`, because a reading
 * whose body has moved must not colour or count anything, and only the backend can compare
 * a hash against a body the window was never sent.
 *
 * **The unread remainder is computed, not guessed.** A file's `loc` is the sum of its
 * functions', so whatever the held readings do not account for is code nobody has read, and
 * it goes to the same absence bucket an unread function node would. Without it a file with
 * three readings out of forty functions would draw as fully read — a coverage claim off a
 * filtered list, which is the failure `work_left` exists to prevent, one surface over.
 */
function contributeHeld(file: Node, mode: ColorMode, span: number, put: Put): void {
  if (mode !== 'legible' && mode !== 'docs' && mode !== 'traps' && mode !== 'surprise') return
  const held = file.pending
  if (!held || held.length === 0) return
  /** Never listed, only counted — see `put` in `bucketsFor`. */
  const stand: {
    synthetic: true
    kind: 'func'
    loc: number
    agent?: AgentReport
    agentStale?: boolean
    children: Node[]
  } = { synthetic: true, kind: 'func', loc: 0, children: [] }
  let read = 0
  for (const r of held) {
    stand.loc = r.loc ?? 0
    stand.agent = r
    stand.agentStale = r.stale === true
    read += stand.loc
    contribute(stand as unknown as Node, false, mode, undefined, span, put)
  }
  const rest = file.loc - read
  if (rest > 0) {
    stand.loc = rest
    stand.agent = undefined
    stand.agentStale = false
    contribute(stand as unknown as Node, false, mode, undefined, span, put)
  }
}

/** The order a breakdown reads in, per lens.
 *
 *  Shared for the reason `contribute` is: the pane's rows and the map's rim segments are one
 *  population, and an order that differed between them would put the same four values in two
 *  arrangements on one screen — which is worse than either order, because it teaches that
 *  position means nothing. On the rim it does a second job the pane does not need: a segment's
 *  POSITION is the only thing that lets two directories be compared at a glance, so it has to
 *  be a property of the lens and never of the wedge's own contents. */
export function sortBuckets<T extends { key: string; lines: number }>(
  rows: T[],
  mode: ColorMode,
): T[] {
  if (mode === 'blame' || mode === 'language') {
    // By lines, matching `legendFor` — so the panel lists them in the order the map's own
    // legend does, and the biggest slice of the picture is the first row in both.
    rows.sort((a, b) => b.lines - a.lines)
  } else if (mode === 'traps') {
    // Traps first: it is the only row anybody opens this lens to find.
    rows.sort((a, b) => Number(b.key === 'trap') - Number(a.key === 'trap'))
  } else if (mode === 'callers') {
    // Most-called first. It was fewest-first, on the argument that the sparse end is what
    // people sweep for — true, and outweighed by the rule now holding every lens together:
    // one direction, loud end leading, so a rim can be compared with the rim beside it and
    // with the bar in the pane. See `GRADES` in `Summary.tsx`.
    const order = CALLER_BANDS.map((b) => b.label)
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  } else if (mode === 'clones') {
    // Biggest group first, on the same argument Traps makes for itself: it is the row
    // anybody opens this lens to find, and the rows below it are context for it.
    const order = [...CLONE_BANDS.map((b) => b.label), 'unique']
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  } else if (mode === 'reach') {
    // The direction Callers reads in — the two lenses are a pair and a reader moving between
    // them must not have to re-learn which way a row of four runs.
    const order = REACH_BANDS.map((b) => b.label)
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  } else if (mode === 'surprise') {
    // Obscure first, mundane last, then the two absences — `Spread` reads exactly this way
    // now that `GRADES` leads with the loud end.
    const order: string[] = ['none', 'some', 'most', 'full', '\u0000expired']
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  } else if (mode === 'legible' || mode === 'docs') {
    // Worst first, loud end first — the direction `Spread` now reads in, and every other
    // breakdown with it. This was best-first for a while on the argument that a bar should
    // run the way its ramp's legend runs; what settled it the other way is that the same
    // breakdown is drawn on the map as a container's rim, where the order is a direction
    // compared across wedges rather than a list read downward. One direction everywhere
    // beats each lens reading the way its own legend happens to.
    const order: string[] = ['none', 'some', 'most', 'full']
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  } else {
    const order = mode === 'churn' ? CHURN_BANDS.map((b) => b.label) : AGE_BANDS.map((b) => b.label)
    rows.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  }
  // Whatever the mode could not color goes last whichever way the rest is sorted: it is
  // the one row that is not a value, and interleaving it by size would read as one.
  //
  // `other` is the same argument one step weaker, so it takes the same place one step
  // earlier: it is not a value either — it is a count of the values there was no color
  // left for — but it IS about code somebody wrote, where the absence row is about code
  // nothing is known of. Sorted by size it would routinely lead a blame breakdown, which is
  // a tail claiming to be the story. See `OTHER_KEY`.
  const rank = (b: { key: string }) => (b.key === UNKNOWN ? 2 : b.key === OTHER_KEY ? 1 : 0)
  return [
    ...rows.filter((b) => rank(b) === 0),
    ...rows.filter((b) => rank(b) === 1),
    ...rows.filter((b) => rank(b) === 2),
  ]
}

/**
 * The subtree broken into the slices the current mode is painting it in.
 *
 * **One walk, and the colors come from `colorFor`'s own inputs rather than a second
 * palette.** A panel that invented its own fills would be a legend disagreeing with the
 * map it sits beside — the failure `Spread` already calls out for the grade ramp, which is
 * why its segments are drawn from `heatColor` too.
 *
 * Scoped like `summarize`: functions a `.sanityignore` set aside are left out, so the
 * bucket counts add up to the `functions` total in the header above them. They are still
 * drawn on the map, and the header still names them separately — what they are not is
 * silently folded into somebody's line count.
 *
 * A ramped mode's band takes the ramp color at the MEAN of its members' ramp inputs, so
 * every swatch here is a color actually on screen rather than a representative guess. The
 * bands are fixed and the colors are measured; doing it the other way round would put a
 * swatch in the key that no wedge is wearing.
 *
 * Whatever the mode cannot color gets a final bucket in the structural neutral rather than
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
  // The caller's span when there is one, and this subtree's only as a fallback for a caller
  // that has no tree above it.
  const span = ageSpan ?? ageSpanOf(root)
  const bucket = new Map<string, Bucket>()
  /** Ramp inputs per bucket, kept only long enough to average them into a fill. */
  const ramps = new Map<string, number[]>()
  const put = (key: string, label: string, fill: string, n: Node, ramp?: number) => {
    let b = bucket.get(key)
    if (!b) {
      b = { key, label, fill, nodes: [], count: 0, lines: 0 }
      bucket.set(key, b)
    }
    // **A stand-in never enters the list.** `contributeCols` and `contributeHeld` speak for
    // functions the window was not sent, through one reused object that is mutated per
    // entry — so pushing it here put the SAME object in the list hundreds of times, and the
    // pane drew a row per phantom, every one of them showing whatever the last iteration
    // had left in the fields. On kibana that was a `6+ callers` list of nameless rows,
    // several of them labelled `calls 2` under a heading about callers.
    //
    // Its LINES still count, because those are what the bar measures and they are real. A
    // bucket can therefore hold more lines than it can name, which is the honest shape: the
    // breakdown is of the whole subtree, and the list is of what there is a node for.
    if (!(n as { synthetic?: boolean }).synthetic) b.nodes.push(n)
    b.count += 1
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
  const walk = (n: Node, out: boolean) => {
    const outOfScope = out || n.excluded
    contribute(n, outOfScope, mode, ranks, span, put)
    // **The pane has the same hole the rim had.** Its breakdown is built by walking function
    // nodes, so on a repo whose rings have not been fetched it listed nothing — an empty
    // `COMMITS BEHIND THESE LINES` over a directory with four thousand files. Same columns,
    // same fix, and it has to be the same call or the pane and the rim would be two answers
    // about one population again.
    if (n.kind === 'file' && !outOfScope && n.funcs > 0) {
      contributeCols(n, mode, ranks, span, put)
      contributeHeld(n, mode, span, put)
    }
    n.children.forEach((c) => walk(c, outOfScope))
  }
  walk(root, false)

  for (const [key, vals] of ramps) {
    const b = bucket.get(key)
    if (!b || vals.length === 0) continue
    const mean = vals.reduce((a, v) => a + v, 0) / vals.length
    // Every one of these walks a ramp, so the swatch is that ramp at the bucket's mean —
    // the color in the key is a color on screen.
    b.fill = ramped(mean, mode === 'churn' ? 'churn' : 'age').fill
  }

  return sortBuckets([...bucket.values()], mode)
}

/** One segment of a directory's rim: a value, its colour, and how many lines hold it. */
export interface Slice {
  key: string
  label: string
  fill: string
  lines: number
}

/**
 * Every directory's own distribution, in one pass.
 *
 * **A container has no reading; it has a POPULATION, and a mean of one is not a summary of
 * it.** `DIR_RIM_PX` argues that a directory's colour is a roll-up of what is inside rather
 * than a reading of the directory — true, and it stopped one step short. What was drawn was
 * that roll-up collapsed to a single number: a hot share, a mean age, a fraction called. A
 * mean over forty thousand functions lands mid-scale every time, which is why Churn, Age,
 * Callers and Reach all drew the same middling ring on kibana. Four different questions,
 * one answer, and the answer was "about average" because averaging is what was being shown.
 *
 * So the rim draws the distribution instead — the same breakdown the pane prints, on the
 * wedge it is about. Nothing is averaged and nothing is hidden: a directory that is half
 * ancient and half rewritten last week reads as two bands, where its mean read as neither.
 *
 * **Bottom-up, because the obvious way is quadratic.** Each directory's histogram is the
 * merge of its children's, so the whole map costs one walk plus a bucket merge per node;
 * asking `bucketsFor` per wedge would re-walk every subtree from the top and cost
 * O(nodes × depth) — about 1.2 million visits on kibana, per layout.
 *
 * **Slim on purpose.** `Bucket` carries the member nodes so the pane can list them; a
 * directory's rim needs a width and a colour, and carrying node lists up the tree would
 * hold the whole repo in memory once per level. Only lines and the ramp mean climb.
 */
export function histogramsFor(
  root: Node,
  mode: ColorMode,
  ranks?: Map<string, number>,
  ageSpan?: number,
  /** Which containers are worth ANSWERING for — the ones the layout drew.
   *
   *  **The walk has to cover the whole subtree; the answer does not.** Completeness is why
   *  this visits every file: a distribution over a sample is a confident picture of a biased
   *  one. But materialising a result is a different cost from visiting a node — it sorts the
   *  buckets and allocates a row apiece — and on kibana that ran for every one of ~7,000
   *  directories to serve the two hundred on screen, with four hundred authors to sort in
   *  each. Measured at 25ms a call under Blame, which is most of a 30fps frame and most of
   *  why a replay stuttered.
   *
   *  Omit it and every container is answered for, which is what a caller with no layout in
   *  hand needs. */
  want?: ReadonlySet<string>,
): Map<string, Slice[]> {
  const out = new Map<string, Slice[]>()
  // Lenses whose containers are marks rather than quantities answer elsewhere — see the
  // dots on the map. A histogram of "contains a trap" is a share, which is the thing those
  // two lenses are written not to say.
  if (mode === 'traps' || mode === 'clones') return out
  const span = ageSpan ?? ageSpanOf(root)

  interface Tally {
    key: string
    label: string
    fill: string
    lines: number
    /** Ramped modes take their swatch from the MEAN of the members' ramp inputs, so the
     *  colour on the rim is a colour a wedge in it is actually wearing. Carried as a sum
     *  and a count rather than an array, because these merge all the way up the tree. */
    sum: number
    n: number
  }

  const add = (into: Map<string, Tally>, t: Tally) => {
    const cur = into.get(t.key)
    if (!cur) {
      into.set(t.key, { ...t })
      return
    }
    cur.lines += t.lines
    cur.sum += t.sum
    cur.n += t.n
  }

  /** **Which lenses a file can answer for when its functions have not been fetched.**
   *
   *  This is the difference between a distribution and a sample of whatever happened to be
   *  loaded. Rings arrive per file and only for files wide enough to draw an inside, so on
   *  a large repo most of the tree has no function nodes — and a histogram built from the
   *  handful that do is not a quiet approximation, it is a confident picture of a biased
   *  subset. Three files with rings, all touched last week, and the directory holding four
   *  thousand draws as entirely fresh.
   *
   *  So a subtree draws its distribution only when every file in it is answered for: by its
   *  own ring, or by itself where its own value means the same thing. Everywhere else the
   *  rim falls back to the roll-up the backend computed over the whole subtree, which is
   *  what was drawn before any of this existed and is complete by construction. */
  const standsIn =
    mode === 'blame' ||
    mode === 'language' ||
    mode === 'age' ||
    mode === 'churn' ||
    mode === 'callers' ||
    mode === 'reach' ||
    mode === 'legible' ||
    mode === 'docs' ||
    mode === 'surprise'

  /**
   * Fold one subtree into `sink`, and answer for it if anybody asked.
   *
   * **The accumulator is passed DOWN rather than built at every node and copied up.** The
   * first version gave each node its own map and merged its children's into it, which is a
   * Map allocation per node and a copy of every key at every level — on a frame of kibana,
   * 125,000 maps and four hundred author keys walked up five levels. It cost 25ms a call
   * under Blame, which is most of a 30fps frame, and it is why a replay stuttered in a way
   * that got worse the further the story ran: the tree grows, so the copying grows with it.
   *
   * Now only a node somebody wants an ANSWER for opens an accumulator of its own. Everything
   * between adds straight into the nearest such ancestor's, so a subtree is counted once
   * instead of once per level it sits under, and the merges that remain are a few hundred
   * rather than a hundred thousand.
   *
   * Returns whether the subtree is WHOLE — see `standsIn`. That has to climb whatever the
   * accumulator does: a hole anywhere under a container disqualifies its distribution, and a
   * node that opens no accumulator still has to report one.
   */
  const walk = (node: Node, outer: boolean, sink: Map<string, Tally>): boolean => {
    const outOfScope = outer || node.excluded
    const answers = node.kind === 'dir' && (!want || want.has(node.id))
    const mine = answers ? new Map<string, Tally>() : sink
    const put: Put = (key, label, fill, n, ramp) =>
      add(mine, {
        key,
        label,
        fill,
        lines: n.loc,
        sum: ramp ?? 0,
        n: ramp === undefined ? 0 : 1,
      })
    contribute(node, outOfScope, mode, ranks, span, put)
    // A file that still holds its functions answers through them; one that does not answers
    // through its columns and its held readings. Never both — `funcs` is zero exactly when
    // the ring has arrived.
    if (node.kind === 'file' && !outOfScope && node.funcs > 0) {
      contributeCols(node, mode, ranks, span, put)
      contributeHeld(node, mode, span, put)
    }
    // A file whose ring has not arrived is a hole unless this lens lets it answer for
    // itself. An excluded one is not a hole: it is deliberately out of the population, and
    // the counts say so elsewhere.
    let whole =
      node.kind !== 'file' ||
      outOfScope ||
      node.funcs === 0 ||
      // Blame and Language need nothing extra — a file carries its own author and language.
      // The numeric lenses need the columns; the reading lenses answer from `pending` and
      // its computed remainder, which together cover every line in the file whether or not
      // anybody has read it.
      (standsIn &&
        (mode === 'blame' ||
          mode === 'language' ||
          mode === 'legible' ||
          mode === 'docs' ||
          mode === 'surprise' ||
          !!node.cols))
    for (const child of node.children) {
      if (!walk(child, outOfScope, mine)) whole = false
    }
    if (answers) {
      if (whole && mine.size > 0) {
        out.set(
          node.id,
          sortBuckets(
            [...mine.values()].map((t) => ({
              key: t.key,
              label: t.label,
              // An empty fill is a ramped bucket waiting for its mean — the same contract
              // `bucketsFor` works to, and the same reason: the band is fixed, the colour is
              // measured.
              fill:
                t.fill === '' && t.n > 0
                  ? ramped(t.sum / t.n, mode === 'churn' ? 'churn' : 'age').fill
                  : t.fill,
              lines: t.lines,
            })),
            mode,
          ),
        )
      }
      // Into the ancestor either way: its population includes this subtree whether or not
      // this one had an answer worth keeping.
      for (const t of mine.values()) add(sink, t)
    }
    return whole
  }
  walk(root, false, new Map())
  return out
}

/** The distinct values present, for a legend. Categorical modes need one; ramps don't. */
export function legendFor(root: Node, mode: ColorMode): string[] {
  if (mode !== 'blame' && mode !== 'language') return []
  const seen = new Map<string, number>()
  const walk = (n: Node) => {
    const key = mode === 'blame' ? n.lastAuthor : n.lang
    // **A file counts for itself when its ring has not arrived.** `funcs > 0` is exactly
    // that test — it is the count a file carries INSTEAD of its children (see `Node.funcs`)
    // — and it is the difference between a legend and an empty box. Rings are fetched only
    // for files wide enough to draw an inside, so at the root of a large repo there are no
    // function nodes at all: linux's ranking came out empty, every author fell to `other`,
    // and the map went grey. Worse, after drilling and coming back it ranked whatever
    // subtree had been visited, under the root's name.
    //
    // It is not an approximation. A file's `lastAuthor` is its own, and the map already
    // paints a file's band with it rather than with a mixture of its functions — so this
    // makes the legend agree with what is drawn. Deepest available unit, the same rule the
    // flash and the gaze follow.
    const speaks = n.kind === 'func' || (n.kind === 'file' && n.funcs > 0)
    // Uncommitted lines never enter the ranking, so they cannot hold a color slot.
    if (key && speaks && (mode !== 'blame' || isAuthor(key))) {
      seen.set(key, (seen.get(key) ?? 0) + n.loc)
    }
    n.children.forEach(walk)
  }
  walk(root)
  // By lines, so the legend is ordered by how much of the picture each one actually is.
  return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k)
}
