import {
  DOC_GAP,
  GRADE_SURPRISE,
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
  type Score,
  type AgentReport,
  type ChurnWindows,
  churnSaturation,
  TANGLE_STRIDE,
  TIME_STRIDE,
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
  | 'tangle'
  | 'surprise'
  | 'legible'
  | 'docs'
  | 'composition'
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
 * **Grouped by where an answer comes from, in the order a new user can get one.** Code shape
 * needs only the scan; interconnectivity needs a grammar that reads calls; activity needs a
 * trace; assessment needs a read, which nobody runs until another lens has convinced them to. So the lenses that answer on first open come first and the ones that cost the most
 * come last. See `FAMILIES`, which the menu draws as four groups and the palette paints as
 * four arcs.
 *
 * **What this gave up: the row no longer ends on a widening time window.** Churn and Age used
 * to lead into History — ninety days, unbounded, the whole story — and that was a real reason
 * for an order. It lost to a better one: assessment cannot come first, and the only place the
 * palette can hold it, with Surprise's amber and the trap's pink where they are, is last.
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
 * **Every digit moved once when this order arrived, and on purpose.** `keys.ts` is emphatic
 * that dropping a lens into the middle shifts the keys after it; this was a regroup of the
 * whole row, done once and deliberately, rather than a lens slipped in.
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
  // **A frame carries the cognitive count now**, banked per function per commit out of the
  // same parse the walk already ran to find the functions — see `HistoryCommit::cog`. What it
  // does not carry is a body, which is why the count is sent rather than the ramp position:
  // the medians it is read against come once, with the tables, from the state the last frame
  // leaves. See `tangleRamp`.
  tangle: 'live',
  surprise: 'live',
  legible: 'live',
  docs: 'live',
  composition: 'live',
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
  // **Code shape first: the lenses a scan answers on its own.** No reader, no git, no trace,
  // so a first-time user opens the menu on lenses that already have something to say — and
  // that is the only argument this app gets to make before anybody has paid for readers.
  //
  // **Complexity leads them.** It paints a repo nobody has done anything to, and it sets up
  // the reading lenses at the other end of the menu: the two are independent — 0.05 and 0.06
  // against the real grades — so a body that is knotty and predictable, or smooth and
  // baffling, is visible as a DISAGREEMENT the moment readings land. That is the argument for
  // paying for them, drawn rather than asserted.
  tangle: 'Complexity',
  composition: 'Composition',
  language: 'Language',
  clones: 'Clones',
  // **Interconnectivity** — the call graph, which the scan also answers, for the languages whose
  // calls it reads.
  callers: 'Callers',
  reach: 'Reach',
  // **Activity: what git says**, which needs a trace, so it follows the lenses that need
  // nothing. Blame sits here rather than beside Language, where it was for looking like it —
  // both are coloured by slot — because the menu is grouped by where an answer comes from now,
  // and Blame's comes from git. Age before Churn, the two time lenses adjacent.
  blame: 'Blame',
  age: 'Age',
  churn: 'Churn',
  // **Assessment LAST, and that is the point of the order.** They are the best lenses
  // here and the only ones that cost a read — and a first-time user has not run one, and will
  // not until another lens has convinced them it is worth it. A menu that opened on four
  // locked rows sold nothing. Traps is read out of the same report, so it closes the run.
  surprise: 'Surprise',
  legible: 'Legibility',
  docs: 'Docs',
  traps: 'Traps',
}

/** The menu's four groups, in menu order — what a lens's answer comes from.
 *
 *  **The palette follows these, not just the rows.** Each family takes one arc of the wheel
 *  with a step between arcs, so the menu reads as four groups before a name is read — see the
 *  palette note in `index.css`. `keys-check` holds this to `MODE_LABEL`'s order, so a lens
 *  moved in one and not the other fails there rather than drawing a divider through a family. */
export const FAMILIES: { label: string; modes: ColorMode[] }[] = [
  { label: 'Code shape', modes: ['tangle', 'composition', 'language', 'clones'] },
  { label: 'Interconnectivity', modes: ['callers', 'reach'] },
  { label: 'Activity', modes: ['blame', 'age', 'churn'] },
  { label: 'Assessment', modes: ['surprise', 'legible', 'docs', 'traps'] },
]

export const MODE_HINT: Record<ColorMode, string> = {
  tangle: 'how complex it is for its size',
  surprise: 'what a reader didn’t see coming',
  legible: 'what reading it was actually like',
  docs: 'what nobody has explained',
  // Not "what is tested" — what the repo is MADE of. Every band is a statement about what a
  // file IS, which is answerable, where what a test covers is not.
  composition: 'what this repo is made of',
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
  // The grades themselves, with the question named once at the dim end — see `GRADE_WORDS`.
  // `full` is dim on all three: the bright end is the one you have to do something about.
  surprise: ['predicted: full', 'none'],
  legible: ['legible: full', 'none'],
  // The only lens whose input is the GAP, which is why `none` is bright here too.
  docs: ['docs: full', 'none'],
  churn: ['settled', 'churning'],
  // Both readings run one way — see `Bands::ramp`, where normal is anchored at the cold end
  // rather than in the middle. The words differ because the questions do: one is measured
  // against the repo's own bodies of that size, the other against an absolute count.
  tangle: ['low', 'very high'],
  // Age's bright end depends on which date it is painting — see `rampEnds`. The entry is the
  // `touched` reading, which is the one this lens has always shown.
  age: ['old', 'recent'],
}

/** The two ends, with Age's second reading resolved.
 *
 *  **`old → recent` and `old → new` are not the same scale said twice.** Under `touched` the
 *  bright end is where work has been happening; under `born` it is code that did not exist
 *  until lately. Same colours, same direction, different claim — and the key is the only
 *  thing on screen that says which, so it cannot go on printing one lens's words over the
 *  other's picture. */
export function rampEnds(mode: ColorMode, views: Views): [string, string] | undefined {
  if (mode === 'age') {
    return views.age.read === 'oldest' ? ['long-standing', 'new'] : ['old', 'recent']
  }
  return RAMP_ENDS[mode]
}

/** Which ramp a lens walks, for anything drawing a key beside it.
 *
 *  The swatch has to walk the SAME ramp the wedges do, now that each reading owns a hue —
 *  otherwise the key under a blue map is an amber gradient. */
export function rampOf(mode: ColorMode): Ramp {
  return RAMP_OF[mode]
}

/** Which ramp each lens walks.
 *
 *  **A `Record`, because the fall-through was `heat` and a new lens fell into it.** The gap did
 *  not look like a gap: Complexity drew a gold map under a green legend, because two places
 *  asked `mode === 'churn' ? 'churn' : 'age'` and one of them fed the swatches. Both go through
 *  here now, and a thirteenth lens fails the build rather than borrowing somebody's colours.
 *
 *  The four that never walk a ramp are listed anyway. Traps and Clones are MARKS — a wedge is
 *  either marked or it is not — and Blame and Language are categorical, coloured by slot. They
 *  are given `heat` because that is what the fall-through gave them and nothing reads it; what
 *  matters is that they are a stated `never` rather than an omission. */
const RAMP_OF: Record<ColorMode, Ramp> = {
  // Categorical, like Blame and Language: four kinds, coloured by slot rather than shaded.
  composition: 'heat',
  tangle: 'tangle',
  surprise: 'heat',
  legible: 'legible',
  docs: 'docs',
  traps: 'heat',
  clones: 'heat',
  callers: 'callers',
  reach: 'reach',
  blame: 'heat',
  language: 'heat',
  age: 'age',
  churn: 'churn',
}

/** Which stop of its ramp a lens's chip quotes.
 *
 *  **Stepped inside each family, so its members come apart by lightness as well as hue.** A
 *  family shares one arc of the wheel on purpose, and at one lightness that arc left
 *  Complexity, Composition and Language 5.1–5.4 apart — one lilac. Stepping 3 / 2 / 4 down each
 *  family takes the closest chips to 10.8, and every family boundary stays louder than every
 *  step inside a family, so the menu still reads as four groups first. The map is untouched:
 *  only the chrome quotes these. Blame, Language and Composition take the same steps in their
 *  `--lens-*` tokens, and the marks quote themselves. */
const CHIP_STOP: Partial<Record<ColorMode, 2 | 3 | 4>> = {
  tangle: 3,
  callers: 3,
  reach: 2,
  age: 2,
  churn: 4,
  surprise: 3,
  legible: 2,
  docs: 4,
}

/** The one colour that stands for a lens, as a custom-property name.
 *
 *  A ramped lens quotes the stop `CHIP_STOP` gives it — never by default the hot end, which is
 *  the loudest colour in the app and belongs to the wedges. Blame, Language and Composition
 *  have nothing on the map to quote: their wedges come out of a categorical palette, and one
 *  slot would paint the lens in whichever value sorted first. Each gets a chrome colour of its
 *  own instead; see `--lens-blame` in index.css for where they come from. */
export function modeToken(mode: ColorMode): string {
  if (mode === 'traps') return '--trap'
  if (mode === 'clones') return '--clone'
  if (mode === 'blame') return '--lens-blame'
  if (mode === 'language') return '--lens-language'
  if (mode === 'composition') return '--lens-composition'
  return `--${rampOf(mode)}-${CHIP_STOP[mode] ?? 3}`
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

/** Which end of a body's own history Age paints — the newest line in it, or the oldest.
 *
 *  **Both were already measured, and the lens only ever showed one of them.** Every node
 *  carries `lastTouchedDays` and `ageDays` — when a commit last touched this body, and when
 *  the oldest surviving part of it first appeared — and the lens has always painted the
 *  first. `docs/notes/time.md` calls that the rejected reading: recency is *where work has
 *  happened*, which the History view already gives you, while the question the lens is FOR
 *  is dusty code, which is the second date. Rather than flipping the lens from one to the
 *  other and making the note's argument for it in one direction only, the reader picks.
 *
 *  It is not a ramp direction. Reversing the ramp paints the same number the other way up;
 *  these are two different numbers about the same body, and on a file rewritten last week out
 *  of code from 2014 they disagree by a decade.
 *
 *  **Named for the LINE, not for the code.** `newest`/`oldest` rather than
 *  `touched`/`first seen`, because the second pair claims more than blame can see: per-line
 *  provenance holds the last commit to touch each line, so a body rewritten wholesale has
 *  nothing left saying when it was first written. The oldest line standing here is a fact.
 *  When this function first appeared is not — see `blame.rs`. */
export type AgeRead = 'newest' | 'oldest'

/** The Age lens's whole calibration, as one value.
 *
 *  **One parameter rather than two, and that is the `cap` lesson.** The span and the reading
 *  are both inputs to the same ramp and they are threaded through the same six components; as
 *  two arguments they are six chances for a caller to pass the span and forget the reading,
 *  and the symptom would be a tooltip disagreeing with the wedge it is over about which date
 *  it is showing. Prepared once in `App` and passed where the span was already passed. */
export interface AgeView {
  /** How far back this repo goes, from `ageSpanOf(root)` — see `ageRamp`. */
  span: number
  read: AgeRead
}

/** The reading a caller gets when it has a node but no view — today's behaviour, on the
 *  short end of the old fixed scale. */
export const AGE_DEFAULT: AgeView = { span: SPAN_UNKNOWN_DAYS, read: 'newest' }

/** How Churn is calibrated: which horizon, out of the four this repo can offer.
 *
 *  **The ladder is the repo's own and is NOT a constant.** A fixed 30/60/90/180 goes inert on
 *  a young project — sanity at 27 days returned the identical 271 commits at all four — so
 *  `edits::windows_for` scales it to a repo that cannot fill it, and every caption naming a
 *  window has to read it from here. A tooltip saying `90d` over a repo whose widest horizon is
 *  27 days is the map claiming a measurement nobody took. */
export interface ChurnView {
  /** The four windows, in days — `Stats.churnWindows`. */
  windows: ChurnWindows
  /** Which rung, 0..3. */
  at: number
  /** Whether the timeline has been walked at all.
   *
   *  **False is not zero churn, and this is the only place that distinction lives.** Until the
   *  walk has run every `Score.churn` is zero, because the count comes from the timeline and
   *  nothing else can produce it; painting that would draw an unwalked repo and a settled one
   *  in the same colour. So the lens says so once, here, and the map paints nothing. */
  measured: boolean
}

/** Both lenses' calibration, as one value threaded on one prop.
 *
 *  **One bag, because the alternative is one prop per lens and the next lens makes three.**
 *  Age needed a span and a reading, Churn needs a ladder and a rung, and every component
 *  between `App` and a wedge passes them through untouched. Two props were already two chances
 *  to thread half of it; the symptom would be a tooltip and the wedge under it disagreeing
 *  about which window they are describing, which reads as a wrong number rather than a
 *  wrong window. */
export interface Views {
  age: AgeView
  churn: ChurnView
  /** Which of Complexity's two readings — see `TangleRead`. */
  tangle: TangleRead
  /** Which of Blame's two readings — see `BlameRead`. */
  blame: BlameRead
  /** What Docs paints a doc a reader judged `derivable` as — see `DerivableRead`. */
  derivable: DerivableRead
}

/** Which of Blame's two readings the lens paints.
 *
 *  **Two reductions of one list, not two measurements.** Every line of a function carries the
 *  name of whoever touched it LAST; `touched` takes the newest of those and `lines` takes the
 *  biggest pile. They disagree often and interestingly: a typo fix in a four-hundred-line body
 *  makes somebody its last toucher while they hold one line of it.
 *
 *  **Neither is authorship and the lens is not called Author for that reason.** Blame reports
 *  who touched each line last, so a body rewritten wholesale reads as new and everyone whose
 *  lines were replaced is gone — not diminished, gone. `touched` is a timestamp with a name on
 *  it; `lines` is who holds what is STANDING, robust to a one-line-per-file sweep and no help
 *  at all against a reformat. Real authorship over time is `git log -L`, refused on cost. See
 *  `TODO.md`, where the three reductions are named.
 *
 *  The third reduction — how many people's lines are here — is not a reading, because it is a
 *  COUNT and this lens paints names. It is a findings field instead: see `Field::Headcount`. */
export type BlameRead = 'touched' | 'lines'

/** What Docs paints a doc a reader judged `derivable` — regenerable from the body it sits on.
 *
 *  **Two opinions, and neither is a measurement.** `none`, the default, is the metric's: a
 *  doc a model could write from the body explains nothing that was not already there, so it
 *  must not paint a wedge as covered. `full` is the other honest reading — the doc does say
 *  what the code does, completely, and a function carrying one is not undocumented. Which
 *  matters depends on whether you are asking what a newcomer learns or what is written down.
 *
 *  Lens only. `reportGrades` counts a derivable doc as `none` whatever this says, so no score
 *  and nothing a reader is told moves with it. */
export type DerivableRead = 'none' | 'full'

/** Whose name a categorical wedge is keyed on.
 *
 *  **One reader, because five had already been written.** `mode === 'blame' ? node.lastAuthor
 *  : node.lang` appeared at five call sites — the fill, the rim histogram, the legend, the
 *  ranks and the roll-up — and a second blame reading means each of them choosing between two
 *  fields. Five copies of one choice is the split brain `CLAUDE.md` names: the ranking and the
 *  picture disagreeing about who a wedge belongs to, which reads as a palette bug. */
export function catKey(
  node: { lastAuthor: string | null; mainAuthor: string | null; lang: string | null },
  mode: ColorMode,
  read: BlameRead,
): string | null {
  if (mode !== 'blame') return node.lang
  return read === 'lines' ? node.mainAuthor : node.lastAuthor
}

/** Which of Complexity's two readings the lens paints.
 *
 *  **`weighted` is the finding and `raw` is the number.** A longer function is naturally more
 *  complicated, so the useful question is whether it is more complicated than its length
 *  suggests — that is `weighted`, each body against the median of others its size in this repo.
 *  Measured, it is independent of line count (rank correlation 0.19, −0.03, 0.07, 0.25 across
 *  four repos, against 0.48–0.68 for the bare count) and independent of Surprise (0.05, 0.06),
 *  so it neither restates the width nor cannibalises the lens it advertises.
 *
 *  `raw` is the cognitive score itself, against an absolute bar of 15 — the published default.
 *  It answers a question `weighted` cannot: *show me everything over the line*, whatever this
 *  repo happens to consider normal.
 *
 *  There is deliberately no third choice. Cyclomatic complexity — the same count without the
 *  nesting weight — orders functions identically to this one (Spearman 0.988–0.999 on three
 *  repos), so offering both would be two controls drawing one map. */
export type TangleRead = 'weighted' | 'raw'

/** Which rung a repo is painted at when nobody has chosen.
 *
 *  The middle-high one, which on a repo old enough to fill the ladder is ninety days — what
 *  Churn has always meant here. The twin of `edits::DEFAULT_WINDOW`. */
export const CHURN_DEFAULT_WINDOW = 2

/** What a caller with a node but no calibration gets: the old fixed scale, and a Churn that
 *  says it has measured nothing. */
export const VIEWS_DEFAULT: Views = {
  age: AGE_DEFAULT,
  churn: { windows: [30, 60, 90, 180], at: CHURN_DEFAULT_WINDOW, measured: false },
  tangle: 'weighted',
  blame: 'touched',
  derivable: 'none',
}


/** The days this reading is about, or null where this node cannot answer it. */
export function ageOf(s: Score, read: AgeRead): number | null {
  return read === 'oldest' ? s.ageDays : s.lastTouchedDays
}

/** What the wedge says out loud, for the reading it is painted in. The two sentences have to
 *  differ in more than a number: `12d` under one reading is when somebody last typed here and
 *  under the other is when the oldest line still standing here was written.
 *
 *  **`oldest line`, never `first seen`.** It was `first seen`, which is a claim this
 *  instrument cannot make: blame reports the last commit to touch each LINE, so a function
 *  rewritten wholesale has no surviving trace of when it was first written and reads as
 *  young. `blame.rs` says so on `RangeHistory::age_days` — "a lower bound, not the truth" —
 *  and the label has to say the same thing. The oldest line here is a fact; when this code
 *  first appeared is not one we hold. */
export function ageLabel(d: number, read: AgeRead): string {
  const when = d < 1 ? 'today' : `${Math.round(d)}d ago`
  return read === 'oldest' ? `oldest line ${when}` : `newest line ${when}`
}

/** The words the bands take, which is the same list of boundaries read two ways — see
 *  `AGE_BANDS`. */
export function ageBandNoun(read: AgeRead): string {
  return read === 'oldest' ? 'oldest line' : 'newest line'
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
 *  **`derivable` replaces it with `derived`** — `none` by default, the same rule
 *  `reportGrades` applies to the number, or `full`; see `DerivableRead`. Whatever grade the
 *  reader also gave the words is not consulted: the judgement that they are regenerable is
 *  the finding, and both readings of it are about that. Every Docs surface asks here with
 *  the same `Views`, because a lens that disagreed with the breakdown beside it would be two
 *  answers to one question. */
export function docGrade(n: Node, derived: DerivableRead): Grade | undefined {
  if (!n.agent || n.agentStale) return undefined
  return n.agent.derivable ? derived : (n.agent.documented ?? undefined)
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
function undocShare(node: Node, derived: DerivableRead): number | null {
  let graded = 0
  let bare = 0
  const walk = (n: Node) => {
    if (n.kind === 'file' || n.kind === 'func') {
      const g = docGrade(n, derived)
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
  /** How Age and Churn are calibrated — see `Views`. Optional because a caller that has a
   *  node but not the tree it came from should still get a colour; it falls back to
   *  `VIEWS_DEFAULT`, which is the old fixed age scale read as recency and a Churn that says
   *  it has measured nothing. */
  views?: Views,
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
        ? // The threshold this counts is `some` or `none`, and `surprising` is the word for
          // that on this tab.
          `${Math.round(t * 100)}% surprising`
        : (() => {
            const w = readingWords(node)
            return w ? `predicted: ${w.predicted}` : `${Math.round(t * 100)}°`
          })(),
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
        // Not `tangled`, which is the Complexity rule "Tangled for its size".
        label: `${Math.round(share * 100)}% hard to follow`,
      }
    }
    const g = node.agentStale ? undefined : legibleOf(node.agent)
    if (!g) return null
    return { ...ramped(GRADE_SURPRISE[g], 'legible'), label: `legible: ${g}` }
  }

  if (mode === 'docs') {
    const derived = views?.derivable ?? VIEWS_DEFAULT.derivable
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
      const own = docGrade(node, derived)
      // `header: none` rather than "covers none": the word is a rung on a ladder, and a
      // sentence built round it has to bend for the bottom one.
      if (own) return { ...ramped(DOC_GAP[own], 'docs'), label: `header: ${own}` }
      // A file nobody has read yet is gray, not an average of its functions. Its own header
      // is the thing this lens asks a file about, and guessing it from the contents would
      // be the map answering a question nobody put to it.
      return null
    }
    if (showsShare(node)) {
      const share = undocShare(node, derived)
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
    const g = docGrade(node, derived)
    if (!g) return null
    return { ...ramped(DOC_GAP[g], 'docs'), label: `docs: ${g}` }
  }

  if (mode === 'composition') {
    // **What a body IS, which is answerable — not what a test covers, which is not.**
    //
    // Four kinds and a neutral. `null` is nothing having placed it, and it is emphatically
    // not "code": where test code cannot be told apart — C++ has no marker for one — a body
    // might be either, and reporting it as hand-written would make every C++ repo look
    // entirely yours.
    //
    // The evidence rides in the label because the tiers are not equal: a generator's own
    // `DO NOT EDIT` banner and a directory somebody named `generated` are both true and only
    // one of them is a fact.
    if (node.kind !== 'func') return null
    const k = node.codeKind
    if (!k) return null
    const fill = KIND_FILL[k.kind]
    return { fill, stop: fill, ink: inkOn(fill), label: `${k.kind} (${k.how})` }
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
    // **The gate is `lastTouchedDays`, and it used to be `ageDays`.** The two are null
    // together on the live map — both come from the same blame range or the same missing
    // path — so this asked "does this repo have history" through whichever one was handy.
    // It stopped being handy the moment Age started PAINTING `ageDays`: a replay stand-in
    // for a file the story never saw arrive now reports a null birth and a real touch date,
    // which is the truth about it and which under the old gate would have silently switched
    // Churn off over the folded half of every frame.
    if (!s || s.lastTouchedDays === null) return null
    const w = views?.churn ?? VIEWS_DEFAULT.churn
    // **Nothing painted until the timeline has been walked.** Every count is zero until then,
    // and zero is a finding — nobody has touched this — which is the one thing it must not be
    // read as here. Said once, on the lens, beside the button that runs the walk; the map goes
    // to the structural neutral, exactly as it does for a repo with no git at all.
    if (!w.measured) return null
    return {
      ...ramped(s.churn[w.at], 'churn'),
      // **One quantity now, at both resolutions, and the label no longer has to disambiguate.**
      // It read `traces to 4 commits` on a function and `27 commits in 90d` on its file,
      // because blame and the log walk were answering different questions under one ramp. Both
      // are the same question off the timeline: commits that CHANGED this, inside the window.
      //
      // The window is named from the repo's own ladder, never as a constant — see `ChurnView`.
      label: churnLabel(s.commits[w.at], w.windows[w.at]),
    }
  }

  if (mode === 'tangle') {
    // **`null` is a grammar nobody taught, and it must not read as simple code.** It comes
    // straight through from `parse::branch_kinds`, which returns no table rather than an empty
    // one for exactly this reason. Grey, like Callers on a language whose calls never resolve.
    if (!s?.tangle) return null
    const read = views?.tangle ?? VIEWS_DEFAULT.tangle
    const at = read === 'raw' ? 1 : 0
    return {
      ...ramped(s.tangle[at], 'tangle'),
      label: tangleLabel(s.cognitive),
    }
  }

  if (mode === 'age') {
    const view = views?.age ?? AGE_DEFAULT
    // Null under one reading and not the other is an ordinary state rather than an edge: a
    // replayed file that predates the window has been touched and was never seen to arrive.
    // The wedge goes uncoloured for the reading it cannot answer and keeps its colour under
    // the other, which is the whole doctrine — absence is stated, never filled in.
    const d = s ? ageOf(s, view.read) : null
    if (d === null) return null
    return {
      ...ramped(ageRamp(d, view.span), 'age'),
      label: ageLabel(d, view.read),
    }
  }

  const key = catKey(node, mode, views?.blame ?? VIEWS_DEFAULT.blame)
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

/** What a wedge is filed under when the timeline has not been walked.
 *
 *  **A different sentence from `NO_HISTORY`, deliberately.** "History not read" is a fact
 *  about this folder — git knows nothing about these lines. This one is a fact about the
 *  TRACE: the repo has history and nobody has counted how often each function changed yet, and
 *  the button that fixes it is in the sidebar. Drawing them as one bucket would tell somebody
 *  their repo has no git when what it has is unfinished work. */
const NOT_WALKED = 'timeline not walked'

/** What a wedge is filed under when its language has no branch table.
 *
 *  A third absence, and a different sentence again: not "this folder has no git" and not "the
 *  timeline is unwalked" but "nobody has taught this parser where this language forks". The
 *  fix is a table in `parse::branch_kinds`, which is nothing a user can press — so unlike the
 *  other two this lock is `keyed: false`. */
const NOT_COUNTED = 'language not counted'


/** The upper line count of each size band but the last, and the two saturation anchors.
 *
 *  **The Rust originals are `tangle::EDGES`, `RAW_HOT` and `WEIGHTED_HOT`, and this is the one
 *  place in the app that copies them.** Every other lens receives its ramp position already
 *  computed — the scan runs in Rust and hands `Score::tangle` over the wire. A REPLAY has no
 *  scan: the timeline carries a raw cognitive count per function per commit, which is the only
 *  thing small enough to send, so the arithmetic has to happen on this side.
 *
 *  The alternative was to send the ramp positions instead. It costs two numbers per changed
 *  function per commit rather than one, and it needs the medians before the first frame is
 *  emitted, which means a second pass over the whole walk. This is six lines and one test —
 *  `a_replayed_frame_paints_what_the_live_map_paints` — that reads the constants from the
 *  Rust source and fails if either side moves. */
export const TANGLE_EDGES = [14, 24, 49, 99, 199, 399, 799, 1599]
const TANGLE_RAW_HOT = 15
const TANGLE_WEIGHTED_HOT = 4

/** Which size band a body of `loc` lines falls in — `tangle::band_of`. */
export function tangleBandOf(loc: number): number {
  const i = TANGLE_EDGES.findIndex((e) => loc <= e)
  return i === -1 ? TANGLE_EDGES.length : i
}

/** The two readings for one body, each on the 0..1 scale the ramp paints — `tangle::Bands::ramp`.
 *
 *  Index 0 is WEIGHTED and index 1 is RAW, matching `TangleRead`. `medians` is the repo's own,
 *  from `Tables.tangleBands`; a `null` band has nothing its size to compare against and falls
 *  back to the raw count, which is all that body can honestly be given. A median of zero is
 *  floored at one, or a body that branches once would read as infinitely worse than normal. */
export function tangleRamp(
  medians: (number | null)[] | undefined,
  loc: number,
  cognitive: number,
): [number, number] {
  const raw = Math.min(1, Math.max(0, cognitive / TANGLE_RAW_HOT))
  const m = medians?.[tangleBandOf(loc)]
  if (m === null || m === undefined) return [raw, raw]
  const ratio = cognitive / Math.max(m, 1)
  const weighted = Math.min(1, Math.max(0, (ratio - 1) / (TANGLE_WEIGHTED_HOT - 1)))
  return [weighted, raw]
}

/** The bands Complexity sorts into. ONE set, under both readings.
 *
 *  **They are degrees, not verdicts, and that is what lets one set serve two questions.**
 *  Both readings are the same shape — how far past a bar a body sits — and only the bar
 *  differs: weighted measures against the median of the other bodies its size in this repo,
 *  raw against 15, the published threshold. So a word naming a POSITION is true under either,
 *  while a word naming the code is not.
 *
 *  Two earlier sets are worth knowing about, because each was right about the thing the next
 *  one broke.
 *
 *  It began as two vocabularies, comparative under weighted (`far above normal · above normal
 *  · slightly above · as expected`) and absolute under raw (`very complex · complex · some
 *  branching · simple`). Precise, and it produced a key nobody could act on: four rows of
 *  "above" and "as expected" that read as tapdancing around saying the code was complicated.
 *  It also meant the words changed under a keypress, so `sortBuckets` had to be told which
 *  reading wrote the rows it was sorting or the order silently did nothing.
 *
 *  Then both were made verdicts — `extremely complex` down to `not complex` — which reads
 *  well and says something false at the bottom: under weighted, a two-hundred-line body
 *  sitting exactly at its band's median holds seventeen decision points, and "not complex" is
 *  not what that is. The bottom band is an ABSENCE of a finding, and only a degree can say so
 *  without claiming the code is simple.
 *
 *  What names the bar is the heading beside them — `Complexity` against `Complexity for its
 *  size` — which is now the only thing on screen that does, and has to stay. */
const TANGLE_BANDS: { label: string; min: number }[] = [
  { label: 'very high', min: 0.75 },
  { label: 'high', min: 0.4 },
  { label: 'moderate', min: 0.05 },
  { label: 'low', min: 0 },
]

/** What a complexity wedge says out loud: a COUNT, never an adjective.
 *
 *  **The word "complexity" invites a verdict and the caption refuses to give one.** `12
 *  decision points` is a fact somebody can go and check; `complex` is a judgement about their
 *  code that this instrument has not earned, and the first thing anyone does with a verdict is
 *  argue with it or game it. Same rule that puts `27 changes in 90d` on a churn wedge rather
 *  than `churn 100%`.
 *
 *  **The same sentence under both readings, because the COUNT is the same under both.** It
 *  used to append "for its size" under the weighted one, which was smuggling the comparison
 *  into a number that never carries it: a body has 329 decision points whichever way you rank
 *  it, and the caption saying otherwise made the count look like it had been adjusted. The
 *  comparison is the COLOUR's, and the band words already say it — `far above normal` under
 *  weighted against `very complex` under raw. A container says the total under it. */
function tangleLabel(cognitive: number | null): string {
  if (cognitive === null) return 'not counted here'
  return `${cognitive} decision ${cognitive === 1 ? 'point' : 'points'}`
}

/** What a churn wedge says out loud: a count, and the window it counts inside.
 *
 *  The window comes from the repo's own ladder every time — never a constant. A tooltip
 *  reading `90d` on a project whose widest horizon is 27 days is the map naming a measurement
 *  nobody took, which is the failure mode a scaled ladder introduces and the only one it
 *  introduces. */
export function churnLabel(commits: number, days: number): string {
  const window = `${days}d`
  if (commits === 0) return `unchanged in ${window}`
  return `${commits} ${commits === 1 ? 'change' : 'changes'} in ${window}`
}

/** Churn bands, in the order the panel lists them — busiest first, because that is the end
 *  of this ramp anyone opens the mode to find. Upper bound is exclusive.
 *
 *  **Unwindowed wording, because the members are functions.** These bucket `Score.commits`,
 *  which on a function is the commits its lines trace back to and not a 90-day rate — the
 *  bottom band read `untouched in 90d` over code whose lines every one of them came from a
 *  commit. What a band can honestly say is how many, not when. */
/** Which lenses a file's COLUMNS can answer — see `Cols`, which is what a file carries when
 *  its ring of functions has not been fetched.
 *
 *  **The pair to `STANDS_IN`, and only honest together.** That one decides whether a file may
 *  stand in for its functions; this one decides whether it has anything to stand in WITH. A
 *  lens in the first and not the second is the worst of the three ways this can go wrong: the
 *  rim draws, confidently, with every ring-less file's lines missing from it — which on a large
 *  repo is most of the tree.
 *
 *  A `Record` for the same reason everything on this page is one now: it was a chain of
 *  `mode !== …` and the twelfth lens was not in it. */
const FROM_COLS: Record<ColorMode, boolean> = {
  // `Cols::kind` carries one entry per function, so a file stands in with its functions' own
  // values rather than with a single point of its own — the same thing `tangle` does.
  composition: true,
  churn: true,
  age: true,
  tangle: true,
  callers: true,
  reach: true,
  // Clones draws DOTS on the map rather than a rim, so `histogramsFor` never asks — but the
  // pane's breakdown is `bucketsFor`, and on a repo with no rings fetched it had nothing to
  // list at all. The columns carry the clone group size, so it can.
  clones: true,
  // **Out, and for two different reasons.** Blame and Language would DOUBLE every directory: a
  // stand-in carries numbers and nothing else, so it falls to the absence bucket while the file
  // has already answered for itself out of its own `lastAuthor` and `lang` — the real 300 lines
  // by author, plus 300 more of `unknown`. The reading lenses are out the other way round:
  // there is nothing in a column to answer them with, and an absence bucket would report a read
  // repo as unread. They answer from `pending` instead — see `contributeHeld`.
  blame: false,
  language: false,
  surprise: false,
  legible: false,
  docs: false,
  traps: false,
}

/** **Which lenses a file can answer for when its functions have not been fetched.**
 *
 *  This is the difference between a distribution and a sample of whatever happened to be
 *  loaded. Rings arrive per file and only for files wide enough to draw an inside, so on a
 *  large repo most of the tree has no function nodes — and a histogram built from the handful
 *  that do is not a quiet approximation, it is a confident picture of a biased subset. Three
 *  files with rings, all touched last week, and the directory holding four thousand draws as
 *  entirely fresh.
 *
 *  So a subtree draws its distribution only when every file in it is answered for: by its own
 *  ring, or by itself where its own value means the same thing. Everywhere else the rim falls
 *  back to the roll-up the backend computed over the whole subtree, which is what was drawn
 *  before any of this existed and is complete by construction.
 *
 *  **A `Record`, and it was a chain of `||` until the twelfth lens was left out of it.** The
 *  symptom was the one this whole mechanism exists to prevent, arriving through the door built
 *  to close it: `src-tauri` drew as ONE shade of purple while the pane beside it read
 *  2,660 / 1,693 / 3,663 / 14,727. Nothing threw, nothing was grey — the map quietly averaged.
 *  That was the third hand-kept list of modes a new lens had to be added to and the third one
 *  it was missed from; the others were the band order and the ramp. A `Record` over
 *  `ColorMode` fails the build instead of the picture. */
const STANDS_IN: Record<ColorMode, boolean> = {
  // A file stands in for functions the window was never sent, out of `Cols::kind`. Without it
  // the rim draws over whichever rings happened to arrive, which at a repo's root is a
  // confident picture of a biased sample.
  composition: true,
  // A file's own tangle is the mean over ALL its functions, computed in Rust rather than over
  // whichever rings happen to have arrived, so it is complete by construction exactly as churn
  // and age are — and `Cols::tangle` carries the per-function values so the distribution is
  // the functions' own rather than one point per file.
  tangle: true,
  surprise: true,
  legible: true,
  docs: true,
  // Traps and Clones never reach here: `histogramsFor` returns before it, because a container
  // under them is a mark rather than a quantity. False rather than absent, so the record stays
  // a statement about every lens there is.
  traps: false,
  clones: false,
  callers: true,
  reach: true,
  blame: true,
  language: true,
  age: true,
  churn: true,
}

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

/** A stand-in's score: the fields it actually measured, and "no claim" for the rest.
 *
 *  **A whole `Score`, so the compiler is the thing that notices when one grows a field.** The
 *  stand-ins are cast through `unknown` — they are not nodes, they are counts wearing a node's
 *  shape so `contribute` can band them by the same rule it bands a real one — and a cast is a
 *  hole in exactly the direction that matters: `Score` gained `churn` as a per-window array,
 *  `contributeCols` went on building an inline object without it, and `tsc` had nothing to say.
 *  It crashed on the first Churn render over a file whose ring had not arrived, which is most
 *  files on a large repo.
 *
 *  Filling every field here rather than in each caller means the next field added to `Score`
 *  breaks this one function, in a build, instead of one surface at runtime. The values are the
 *  ones that mean nobody looked: `analyzedShare` 0 is what `isAnalyzed` refuses to colour, and
 *  `provenance: 'none'` claims no documentation. */
function standScore(measured: {
  commits?: ChurnWindows
  churn?: ChurnWindows
  ageDays?: number | null
  lastTouchedDays?: number | null
  /** Omitted by a caller that has not measured one. Null rather than zero: a zero is a body
   *  that never forks, which is a claim.
   *
   *  **Every field here is optional for that reason, and the defaults below are the
   *  absences.** A fold answers one lens at a time — the Age/Churn row carries dates and no
   *  complexity, the Complexity row carries a ramp and no dates — and a stand-in that
   *  defaulted a missing field to zero would put a whole rolled-up directory in the coldest
   *  band of a lens it never measured. */
  tangle?: [number, number] | null
  cognitive?: number | null
}): Score {
  return {
    churn: [0, 0, 0, 0],
    commits: [0, 0, 0, 0],
    ageDays: null,
    lastTouchedDays: null,
    tangle: null,
    cognitive: null,
    ...measured,
    surprise: 0,
    documented: 0,
    allCommits: null,
    provenance: 'none',
    hotShare: 0,
    source: 'proxy',
    analyzedShare: 0,
  }
}

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
export const UNKNOWN ='\u0000unknown'

/** What each kind is painted with — see `model::Kind`.
 *
 *  **Code gets a colour of its own, and deliberately not the neutral.** Grey means "we do
 *  not know" everywhere else here, and code is the most confident thing this lens says — a
 *  file that went through a real grammar with nothing marking it otherwise. Wearing the
 *  absence colour put the commonest real answer in the shade reserved for having none. */
/** `Cols::kind`'s integers, in the order the backend writes them. */
export const KIND_ORDER = ['code', 'test', 'generated', 'vendored', 'header'] as const

export const KIND_FILL: Record<'code' | 'test' | 'generated' | 'vendored' | 'header', string> = {
  // The categorical palette, the same one Blame and Language spend — one set of slots for
  // every lens that colours by category rather than by degree. It is already the palette the
  // CVD margin was measured against, and a second hand-mixed set beside it would be a second
  // thing to check every time either moved.
  //
  // FIXED slots rather than ranked ones, which is the one way this differs from Blame: there
  // are five kinds and there always will be, so each keeps its colour across every repo. A
  // key you can learn is worth more here than putting the biggest band in slot one.
  code: 'var(--cat-3)',
  // **Not the slot next to code's.** Header was `--cat-6`, a sage, chosen because a header is
  // code-adjacent — which is the wrong instinct: nearness in MEANING is not a reason for
  // nearness in hue, and two greens side by side in a five-row key is a key you have to read
  // twice. Five bands is few enough that maximum separation is the only thing worth
  // optimising for, and this is the hue nothing else here wears.
  header: 'var(--cat-4)',
  test: 'var(--cat-1)',
  generated: 'var(--cat-2)',
  vendored: 'var(--cat-5)',
}

function contribute(
  n: Node,
  outOfScope: boolean,
  mode: ColorMode,
  ranks: Map<string, number> | undefined,
  /** Both lenses' calibration — see `Views` for why they travel as one value. */
  view: Views,
  put: Put,
): void {
  const { span, read } = view.age
  const churn = view.churn
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
  // **What it CAN say, it says.** Skipping outright was the first repair and it went too far:
  // with the roll-ups gone the distribution was drawn over whatever the frame had happened to
  // materialise, so ceph's `src/pybind` — 71% Python, 29% TypeScript, measured — came out as
  // 100% TypeScript over 517 of its 195,516 lines. A biased sample stated with total
  // confidence is the failure `histogramsFor` opens by naming, and it is worse than the
  // mislabelled absence it replaced, because nothing about it looks wrong.
  //
  // So a roll-up now carries a tally of what it folded (see `Node.folded`) and its lines go
  // back into the distribution under the values they actually belong to. Per FILE, which is
  // the grain a file already answers at when its ring has not arrived.
  //
  // Where there is no tally for this lens the old rule stands and the lines go nowhere: Age
  // and Churn are facts about a FUNCTION, the frame carries no per-file dates, and a roll-up
  // that guessed a band would be inventing the reading. `rest` is the marker for both cases —
  // nothing but a roll-up ever carries one, since the backend never sets it and the layout
  // mints its own after this walk.
  if (n.rest !== undefined) {
    if (outOfScope) return
    const held = n.folded
    if (!held) return
    // Never listed, only counted: these lines have no node to point at, which is the same
    // contract `contributeCols`'s stand-in works to — see `put` in `bucketsFor`. One object,
    // mutated per entry, for the reason that one does it: a fresh node per folded file, per
    // frame, is an allocation this codebase has already paid for once.
    const stand: {
      synthetic: true
      kind: 'func'
      loc: number
      score?: Score
      /** The Testing lens reads both, and a stand-in that omitted them would report every
       *  ring-less file as unclassifiable — the confident-wrong-colour failure this whole
       *  stand-in exists to avoid. */
      tested?: { isTest: boolean; how: 'contract' | 'reader' | 'convention' } | null
      underTest?: boolean | null
      children: Node[]
    } = { synthetic: true, kind: 'func', loc: 0, children: [] }
    if (mode === 'language' || mode === 'blame') {
      for (const [key, lines] of mode === 'language' ? held.lang : held.author) {
        const rank = ranks?.get(key)
        stand.loc = lines
        if (rank === undefined) put(OTHER_KEY, OTHER_LABEL, OTHER, stand as unknown as Node)
        else put(key, key, slotColor(rank), stand as unknown as Node)
      }
      return
    }
    if (mode === 'composition') {
      // The same two answers the function branch below gives, a kind or `unplaced`, in the
      // same colours — so a folded body and a drawn one cannot land in different rows.
      for (const [key, lines] of held.kind) {
        stand.loc = lines
        if (key === 'unplaced') {
          put(UNKNOWN, 'unplaced', 'var(--unanalyzed)', stand as unknown as Node)
        } else {
          const k = key as (typeof KIND_ORDER)[number]
          put(k, k, KIND_FILL[k], stand as unknown as Node)
        }
      }
      return
    }
    if (mode === 'age' || mode === 'churn') {
      // **Through `contribute` itself, so a folded file and a drawn one cannot fall in
      // different bands.** The tally is a `TimeRow` per file and the branches below already
      // know what to do with exactly that; running it back through them is the same trick
      // `contributeCols` plays for a file whose ring never arrived, and it is what keeps one
      // definition of a band rather than two.
      for (let i = 0; i < held.time.length; i += TIME_STRIDE) {
        const touched = held.time[i]
        const born = held.time[i + 1]
        stand.loc = held.time[i + 2]
        const commits = held.time.slice(i + 3, i + 7) as ChurnWindows
        // `-1` is a file the replayed window never saw touched, or never saw arrive — every
        // file in the opening state is the second. Undated rather than dropped: the lines are
        // real, and the window's own rule is that nothing before it makes a claim about its
        // age, which is the absence bucket and not a band.
        //
        // **Reported separately, where they used to be one number twice.** The fold carried a
        // touch date and wrote it into both fields, which was harmless while `ageDays` was
        // only a gate and is a lie the moment Age paints it — a file from the truncated prefix
        // would have been banded as *oldest line* on the day the story happened to reach it.
        stand.score =
          touched < 0 && born < 0
            ? undefined
            : standScore({
                commits,
                // **Derived here rather than carried, and that changed owner rather than
                // moving.** The row used to bring its own ramp value so `colorMode` would not
                // hold a second copy of `CHURN_SATURATION` — right while that constant was the
                // replay's private business. It is `api.ts`'s now, shared with the live map,
                // because a repo picks its own windows and the two halves must agree about
                // what saturates one. One owner, so deriving is the single-source version.
                churn: commits.map((n, w) =>
                  Math.min(1, n / churnSaturation(churn.windows[w])),
                ) as ChurnWindows,
                ageDays: born < 0 ? null : born,
                lastTouchedDays: touched < 0 ? null : touched,
              })
        contribute(stand as unknown as Node, false, mode, ranks, view, put)
      }
      return
    }
    if (mode === 'tangle') {
      // Through `contribute` itself, exactly as Age and Churn go — see the note above. The
      // fold carries the file's own answer, which is what `Node::aggregate` gives a file on
      // the live map: a LOC-weighted mean of its functions' ramp positions and the sum of
      // their counts.
      for (let i = 0; i < held.tangle.length; i += TANGLE_STRIDE) {
        stand.loc = held.tangle[i]
        const weighted = held.tangle[i + 1]
        const cognitive = held.tangle[i + 3]
        // `-1` is a file in a language nobody has taught the parser. Its lines are real and
        // stay in the distribution; what it has no opinion about is the band, which is the
        // absence the lens already draws in the structural neutral.
        stand.score =
          weighted < 0
            ? undefined
            : standScore({
                tangle: [weighted, held.tangle[i + 2]],
                cognitive,
              })
        contribute(stand as unknown as Node, false, mode, ranks, view, put)
      }
      return
    }
    // Callers, Reach, Clones and the reading lenses: a roll-up has nothing to say and says
    // nothing. Its lines stay out of the distribution rather than inventing a band.
    return
  }
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
    const key = catKey(n, mode, view.blame)
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
    const g = docGrade(n, view.derivable)
    if (g) put(g, g,heatColor(DOC_GAP[g], 'docs'), n)
    else put(UNKNOWN, 'unread', 'var(--unanalyzed)', n)
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
        put('\u0000expired', 'stale', 'var(--unanalyzed)', n)
      } else if (n.agent) {
        const g = n.agent.predicted ?? (n.agent.surprised ? 'none' : 'full')
        put(g, g, heatColor(GRADE_SURPRISE[g]), n)
      } else {
        put(UNKNOWN, 'unread', 'var(--structure)', n)
      }
    } else if (mode === 'composition') {
      // Not read off a reading: a file's kind comes from what the repo declared and what its
      // path says, so the absence here is "nothing placed this" rather than "nobody has read
      // it". It takes the unanalyzed neutral for the reason Callers goes grey where calls
      // were never parsed.
      const k = n.codeKind
      if (!k) {
        put(UNKNOWN, 'unplaced', 'var(--unanalyzed)', n)
      } else {
        put(k.kind, k.kind, KIND_FILL[k.kind], n)
      }
    } else if (mode === 'legible' || mode === 'docs' || mode === 'traps') {
      // Both are read straight off the reading, so both share one absence: a function
      // nobody has read yet. It is a bucket rather than a drop, for the same reason the
      // map grays it rather than hiding it — a breakdown that silently omits the unread
      // reports a coverage it has not got.
      const r = n.agent && !n.agentStale ? n.agent : undefined
      if (!r) {
        put(UNKNOWN, 'unread', 'var(--unanalyzed)', n)
      } else if (mode === 'traps') {
        // A dated answer falls in with the unread, one bucket, for the reason the legible
        // branch below gives: from where the reader stands they are the same fact.
        if (r.trapDated) {
          put(UNKNOWN, 'unread', 'var(--unanalyzed)', n)
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
        const g = docGrade(n, view.derivable)
        if (g) put(g, g,heatColor(DOC_GAP[g], 'docs'), n)
        else put(UNKNOWN, 'not graded', 'var(--unanalyzed)', n)
      } else if (legibleOf(r)) {
        const g = legibleOf(r)!
        put(g, g, heatColor(GRADE_SURPRISE[g], 'legible'), n)
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
      const key = catKey(n, mode, view.blame)
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
    } else if (mode === 'tangle') {
      if (s?.tangle) {
        const at = view.tangle === 'raw' ? 1 : 0
        const band =
          TANGLE_BANDS.find((b) => s.tangle![at] >= b.min) ?? TANGLE_BANDS[TANGLE_BANDS.length - 1]
        put(band.label, band.label, '', n, s.tangle[at])
      } else {
        put(UNKNOWN, NOT_COUNTED, 'var(--unanalyzed)', n)
      }
    } else if (mode === 'churn') {
      // Same gates `colorFor` uses, so a wedge the map left gray is not given a band here:
      // the repo-level one first — an unwalked timeline has no counts, only zeroes — and then
      // the per-node date, which moved off `ageDays` for the reason spelled out there.
      if (!churn.measured) {
        put(UNKNOWN, NOT_WALKED, 'var(--unanalyzed)', n)
      } else if (s && s.lastTouchedDays !== null) {
        const at = s.commits[churn.at]
        const band = CHURN_BANDS.find((b) => at >= b.min) ?? CHURN_BANDS[CHURN_BANDS.length - 1]
        put(band.label, band.label, '', n, s.churn[churn.at])
      } else {
        put(UNKNOWN, NO_HISTORY, 'var(--unanalyzed)', n)
      }
    } else {
      // The reading the map is painted in, or the band list describes a different question
      // from the colours beside it — see `AgeView`.
      const d = s ? ageOf(s, read) : null
      if (d !== null) {
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
  view: Views,
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
  if (!FROM_COLS[mode]) return
  const c = file.cols
  if (!c) return
  const stand: {
    /** Never listed, only counted — see `put` in `bucketsFor`. */
    synthetic: true
    kind: 'func'
    loc: number
    score?: Score
      /** Composition reads this, and a stand-in that omitted it would report every ring-less
       *  file as unplaced — the confident wrong colour this stand-in exists to avoid. */
      codeKind?: Node['codeKind']
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
    const counts = c.commits[i] ?? [-1, -1, -1, -1]
    // Thousandths back to the 0..1 the ramp paints; `-1` is a language with no branch table,
    // which `contribute` draws grey rather than cold.
    const t = c.tangle?.[i]
    const tangle: [number, number] | null =
      !t || t[0] < 0 ? null : [t[0] / 1000, t[1] / 1000]
    // **Three absences, not one.** This was `no commits AND no touch date`, which is the right
    // question for the two git lenses and the wrong one for Complexity — that is read off the
    // parse and does not care whether the repo has a history at all. On a repo with no git the
    // whole score went `undefined` and every ring-less file dropped out of the rim.
    stand.score =
      counts[0] < 0 && c.touched[i] < 0 && tangle === null
        ? undefined
        : standScore({
            tangle,
            commits: counts.map((n) => Math.max(0, n)) as ChurnWindows,
            // **The ramp, which this stand-in used to omit entirely and got away with because
            // it is cast through `unknown`.** The churn branch reads it to colour the band, so
            // an absent one is not a missing colour — it is a crash on the first Churn render
            // over a file whose ring has not arrived, which is most files on a large repo.
            // Derived here from the shared `churnSaturation`, exactly as the fold derives it.
            churn: counts.map((n, w) =>
              Math.min(1, Math.max(0, n) / churnSaturation(view.churn.windows[w])),
            ) as ChurnWindows,
            // `ageDays` is the gate `contribute` checks for "this repo has history", and
            // its VALUE is unused there — the bands read `commits` and `lastTouchedDays`.
            ageDays: 0,
            lastTouchedDays: c.touched[i] < 0 ? null : c.touched[i],
          })
    stand.callers = c.callers[i] < 0 ? undefined : c.callers[i]
    // **`null` for the absence, never `undefined`.** The Testing arm reads `underTest` and
    // treats undefined and null alike, but `tested` has to come back a real object for a
    // body that IS one — the band is `test`, not `cannot tell`, and a stand-in that dropped
    // it would report a repo's test files as unclassifiable.
    //
    // `how` is `convention` because a column carries the answer and not the evidence for it.
    // That is honest rather than lazy: this is a stand-in, and the panel that wants to say
    // which tier decided has the function node in front of it by then.
    // `how` is `convention` because a column carries the answer and not the evidence for it.
    // Honest rather than lazy: this is a stand-in, and anything wanting to name the tier has
    // the function node in front of it by then.
    const k = c.kind?.[i] ?? -1
    stand.codeKind =
      k >= 0 && k < KIND_ORDER.length
        ? { kind: KIND_ORDER[k], how: 'convention' as const }
        : null
    stand.calls = c.calls[i] < 0 ? undefined : c.calls[i]
    stand.comparable = c.clones[i] < 0 ? undefined : 1
    stand.cloneSize = c.clones[i] > 0 ? c.clones[i] : undefined
    contribute(stand as unknown as Node, false, mode, ranks, view, put)
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
function contributeHeld(file: Node, mode: ColorMode, view: Views, put: Put): void {
  if (mode !== 'legible' && mode !== 'docs' && mode !== 'traps' && mode !== 'surprise') return
  // **No held readings is a file nobody has read, not a file with nothing to say.** This returned
  // here, before the remainder, so a ring-less file with no readings put its lines in no band —
  // while `histogramsFor` called its directory whole on the promise below, and a breakdown under
  // any reading lens came up short of the map. `pending` is only ever set where readings exist
  // (see `held` in `applyAgentReports`), so its absence always means unread.
  const held = file.pending ?? []
  /** Never listed, only counted — see `put` in `bucketsFor`. */
  const stand: {
    synthetic: true
    kind: 'func'
    loc: number
    agent?: AgentReport
    agentStale?: boolean
    /** How many functions this stand-in speaks for — see `put` in `bucketsFor`. */
    count?: number
    children: Node[]
  } = { synthetic: true, kind: 'func', loc: 0, children: [] }
  let read = 0
  for (const r of held) {
    stand.loc = r.loc ?? 0
    stand.agent = r
    stand.agentStale = r.stale === true
    stand.count = 1
    read += stand.loc
    contribute(stand as unknown as Node, false, mode, undefined, view, put)
  }
  const rest = file.loc - read
  if (rest > 0) {
    stand.loc = rest
    stand.agent = undefined
    stand.agentStale = false
    // The remainder is every function no reading covers, not one.
    stand.count = Math.max(0, file.funcs - held.length)
    contribute(stand as unknown as Node, false, mode, undefined, view, put)
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
/** How each lens orders its breakdown: a list of band labels, worst first — or `'lines'` where
 *  the rows are a cast rather than a scale.
 *
 *  **A `Record`, because this was nine `else if`s and a fall-through, and the fall-through is
 *  where a new lens landed.** `indexOf` returns −1 for a key that is not in the list, so a lens
 *  nobody added here did not sort into some sensible default — every one of its rows tied at
 *  −1 and came out in arrival order, which reads as a shuffled panel rather than as a missing
 *  entry. A record over `ColorMode` makes a thirteenth lens a build failure.
 *
 *  A function per entry rather than an array so a list is built where it is read, next to the
 *  reason for its direction, rather than hoisted into a table of names with the arguments left
 *  behind. It took a `TangleRead` for a while: Complexity's words used to change under its own
 *  switch, so a sort had to be told which reading wrote the rows it was handed. One set of
 *  words retired that — see `TANGLE_BANDS`. */
const BUCKET_ORDER: Record<ColorMode, 'lines' | (() => readonly string[])> = {
  // By lines, because the row PRINTS lines. A column of numbers not in their own order reads
  // as a bug, and it was one: these rows sorted by `lines` while printing `count`.
  //
  // **This deliberately does not match the legend, and the comment here used to claim it did.**
  // It said "matching `legendFor`" — half true, which is worse than wrong. `legendFor` does
  // return line order, and then `ColorKey` re-sorts it into slot order before drawing, for its
  // own reason: a legend that reordered as a replay ran would animate its own ranking, which is
  // the bug `authorRank` exists to have killed.
  //
  // The two surfaces answer two questions and the orders follow from that. A legend is a KEY,
  // ordered by the repo-wide all-time cast (`stats.authors`, ranked by COMMITS) so a person's
  // place in it does not move when you drill or when the playhead does. This is a DISTRIBUTION
  // of what you have OPEN — `Detail` hands it `focus`, so it is the wedge you drilled into or
  // clicked, never the one the pointer happens to be over — ordered by how much of that picture
  // each person holds: LINES, here, not everywhere. On ceph the two disagree loudly and both
  // are right: one 642-file whitespace sweep makes somebody the first row here who is nowhere
  // near the first sixteen there.
  blame: 'lines',
  language: 'lines',
  // Traps first: it is the only row anybody opens this lens to find. One name rather than a
  // full list, which works because an unlisted key now sorts LAST — see `rank`.
  traps: () => ['trap'],
  // Loud end leading, like every other lens: what somebody opens Testing for is what nothing
  // exercises. `no test calls this` is the finding, `a test calls this` is the reassurance,
  // and the tests themselves are context under both.
  //
  // **`test` is listed rather than left out.** An unlisted key is `indexOf` −1, which sorts
  // BEFORE index 0 — so omitting it would have put the tests at the top of the panel, which
  // is precisely the opposite of what the comment above claimed. `cannot tell` stays
  // unlisted on purpose: it is the absence bucket every lens keeps at the end.
  // By lines, like Blame and Language and for the same reason the entry above this one
  // gives: the row PRINTS lines, and a column of numbers not in their own order reads as a
  // bug. It was a fixed order for a while — what is not yours at the top — which put ceph's
  // 1,178,464 lines of code underneath its 1,469 of generated.
  //
  // The LEGEND keeps its fixed order deliberately. That is a key rather than a table: it
  // carries no numbers to be out of order, and a key whose rows move between repos is one
  // nobody can learn.
  composition: 'lines',
  // Most-called first. It was fewest-first, on the argument that the sparse end is what people
  // sweep for — true, and outweighed by the rule now holding every lens together: one
  // direction, loud end leading, so a rim can be compared with the rim beside it and with the
  // bar in the pane. See `GRADES` in `Summary.tsx`.
  callers: () => CALLER_BANDS.map((b) => b.label),
  // Biggest group first, on the same argument Traps makes for itself: it is the row anybody
  // opens this lens to find, and the rows below it are context for it.
  clones: () => [...CLONE_BANDS.map((b) => b.label), 'unique'],
  // The direction Callers reads in — the two lenses are a pair and a reader moving between them
  // must not have to re-learn which way a row of four runs.
  reach: () => REACH_BANDS.map((b) => b.label),
  // Obscure first, mundane last, then the two absences — `Spread` reads exactly this way now
  // that `GRADES` leads with the loud end.
  surprise: () => ['none', 'some', 'most', 'full', '\u0000expired'],
  // Worst first, loud end first — the direction `Spread` now reads in, and every other
  // breakdown with it. This was best-first for a while on the argument that a bar should run
  // the way its ramp's legend runs; what settled it the other way is that the same breakdown is
  // drawn on the map as a container's rim, where the order is a direction compared across
  // wedges rather than a list read downward. One direction everywhere beats each lens reading
  // the way its own legend happens to.
  legible: () => ['none', 'some', 'most', 'full'],
  docs: () => ['none', 'some', 'most', 'full'],
  churn: () => CHURN_BANDS.map((b) => b.label),
  age: () => AGE_BANDS.map((b) => b.label),
  tangle: () => TANGLE_BANDS.map((b) => b.label),
}

export function sortBuckets<T extends { key: string; lines: number }>(
  rows: T[],
  mode: ColorMode,
): T[] {
  const spec = BUCKET_ORDER[mode]
  if (spec === 'lines') {
    rows.sort((a, b) => b.lines - a.lines)
  } else {
    const order = spec()
    // **An unlisted key sorts LAST, where `indexOf` alone put it first.** −1 is smaller than
    // every real position, so a row this lens has no band for used to lead the panel — which
    // is how a mismatch between the labels a lens WRITES and the labels it SORTS by showed up:
    // not as an empty list or an error, but as a breakdown in arrival order with the odd row
    // on top. Last is the honest place for it, and it is where the absence rows already go.
    const rank = (k: string) => {
      const i = order.indexOf(k)
      return i < 0 ? order.length : i
    }
    rows.sort((a, b) => rank(a.key) - rank(b.key))
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
  /** How Age and Churn are calibrated — see `Views`. `root` here is whatever is on screen,
   *  which under a drill is one directory: deriving the age span from it would put the panel
   *  on a different scale from the map beside it the moment you drilled in, and taking either
   *  reading from anywhere but the caller would have the rows answering a different question
   *  from the wedges. */
  views?: Views,
): Bucket[] {
  // The caller's span when there is one, and this subtree's only as a fallback for a caller
  // that has no tree above it.
  const view: Views = {
    age: views?.age ?? { span: ageSpanOf(root), read: 'newest' },
    churn: views?.churn ?? VIEWS_DEFAULT.churn,
    tangle: views?.tangle ?? VIEWS_DEFAULT.tangle,
    blame: views?.blame ?? VIEWS_DEFAULT.blame,
    derivable: views?.derivable ?? VIEWS_DEFAULT.derivable,
  }
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
    // **How many functions this row stands for, which is not always one.** A file whose ring has
    // not arrived answers Blame and Language for every function in it at once, and a file's
    // unread remainder is every function no held reading covers. Each counted as one, and a
    // breakdown's function totals depended on which rings had happened to be fetched: sanity's
    // Blame table listed 1,852 functions for a repo of 1,960.
    b.count +=
      n.kind === 'file' && (mode === 'blame' || mode === 'language')
        ? n.funcs
        : ((n as { count?: number }).count ?? 1)
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
    contribute(n, outOfScope, mode, ranks, view, put)
    // **The pane has the same hole the rim had.** Its breakdown is built by walking function
    // nodes, so on a repo whose rings have not been fetched it listed nothing — an empty
    // `COMMITS BEHIND THESE LINES` over a directory with four thousand files. Same columns,
    // same fix, and it has to be the same call or the pane and the rim would be two answers
    // about one population again.
    if (n.kind === 'file' && !outOfScope && n.funcs > 0) {
      contributeCols(n, mode, ranks, view, put)
      contributeHeld(n, mode, view, put)
    }
    n.children.forEach((c) => walk(c, outOfScope))
  }
  walk(root, false)

  for (const [key, vals] of ramps) {
    const b = bucket.get(key)
    if (!b || vals.length === 0) continue
    const mean = vals.reduce((a, v) => a + v, 0) / vals.length
    // Every one of these walks a ramp, so the swatch is that ramp at the bucket's mean —
    // the color in the key is a color on screen. **Through `rampOf`, which is the one place
    // that knows** — this was `mode === 'churn' ? 'churn' : 'age'`, a binary written when there
    // were two banded lenses, and a third one fell straight through it: Complexity drew a gold
    // map beside a green legend, both of them confidently.
    b.fill = ramped(mean, rampOf(mode)).fill
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
  views?: Views,
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
  const view: Views = {
    age: views?.age ?? { span: ageSpanOf(root), read: 'newest' },
    churn: views?.churn ?? VIEWS_DEFAULT.churn,
    tangle: views?.tangle ?? VIEWS_DEFAULT.tangle,
    blame: views?.blame ?? VIEWS_DEFAULT.blame,
    derivable: views?.derivable ?? VIEWS_DEFAULT.derivable,
  }

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

  /** Whether a file can stand in for its own functions — see `STANDS_IN`, which holds the
   *  list and the reason it is a `Record`. */
  const standsIn = STANDS_IN[mode]

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
    contribute(node, outOfScope, mode, ranks, view, put)
    // A file that still holds its functions answers through them; one that does not answers
    // through its columns and its held readings. Never both — `funcs` is zero exactly when
    // the ring has arrived.
    if (node.kind === 'file' && !outOfScope && node.funcs > 0) {
      contributeCols(node, mode, ranks, view, put)
      contributeHeld(node, mode, view, put)
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
                  ? ramped(t.sum / t.n, rampOf(mode)).fill
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

/** Whether a picture holds lines nobody has committed, which Blame paints as themselves.
 *
 *  **Separate from `legendFor`, because that list is where slots come from** — `rankCategories`
 *  numbers it — and a state must never hold a slot. The key needs to know anyway: a working tree
 *  mid-edit draws grey wedges under Blame, and a key that names only authors leaves them
 *  unexplained. Same walk and the same `speaks` rule as `legendFor`, so the two agree on what
 *  the picture holds. */
export function holdsUncommitted(root: Node, read: BlameRead = 'touched'): boolean {
  let found = false
  const walk = (n: Node) => {
    if (found) return
    const speaks = n.kind === 'func' || (n.kind === 'file' && n.funcs > 0)
    if (speaks && catKey(n, 'blame', read) === UNCOMMITTED) {
      found = true
      return
    }
    n.children.forEach(walk)
  }
  walk(root)
  return found
}

/** The distinct values present, for a legend. Categorical modes need one; ramps don't. */
export function legendFor(root: Node, mode: ColorMode, read: BlameRead = 'touched'): string[] {
  // **Composition lists the kinds that are actually there.** Its colours are fixed per kind
  // rather than handed out by rank, so this is used only to say what EXISTS — the key keeps
  // its own order. A legend naming `vendored` over a repo with none is a swatch for a colour
  // nothing on screen is wearing, which is the same failure a merged rim band makes.
  if (mode === 'composition') {
    const seen = new Set<string>()
    const walk = (n: Node) => {
      // The absence is a band like any other and has to be able to appear in the key: a repo
      // holding something nothing could place should say so, and one holding none should not
      // advertise the swatch.
      // A replay's roll-up has no kind of its own and lists what it folded — see `Folded.kind`.
      if (n.folded) {
        for (const [k] of n.folded.kind) seen.add(k)
      } else if (n.kind === 'func') {
        seen.add(n.codeKind?.kind ?? 'unplaced')
      }
      // A file stands in for functions the window was never sent — `Cols::kind` carries them,
      // and without this the key on a large repo lists whatever rings happened to arrive.
      if (n.kind === 'file' && n.cols) {
        for (const k of n.cols.kind ?? []) {
          seen.add(k >= 0 && k < KIND_ORDER.length ? KIND_ORDER[k] : 'unplaced')
        }
      }
      n.children.forEach(walk)
    }
    walk(root)
    return [...seen]
  }
  if (mode !== 'blame' && mode !== 'language') return []
  const seen = new Map<string, number>()
  const walk = (n: Node) => {
    const key = catKey(n, mode, read)
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
