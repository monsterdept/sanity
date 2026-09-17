import { useCallback, useMemo, useState, type RefObject } from 'react'
import type { Held, Node, ProjectSummary, Scan } from '../lib/api'
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
} from '../lib/colorMode'
import { historyLangs } from '../lib/history'
import { lensKey } from '../lib/lensKey'
import { gradedCounts, locksFor } from '../lib/locks'
import type { MovieKey } from '../lib/movie'
import { isCapped, loadCap, saveCap, type Capped } from '../lib/palette'
import { viewsFor } from '../lib/reportInputs'
import { loadRings, saveRings } from '../lib/rings'
import { BAND_SHARE, SPACING_DEFAULT } from '../lib/spacing'
import type { Deltas, Tables } from '../lib/timeline'
import { findById } from '../lib/tree'
import { sameRanks, useSteady } from './useSteady'

/** Every choice about how the map is painted that is not WHICH project: the lens, its
 *  sub-readings, the ring count and the color caps. None of it is per project — see
 *  `useProjects`, which banks the lens alone on a switch. */
export function useLensChoices() {
  // One geometry, five encodings. The sunburst was never the thing worth swapping out —
  // what changes the question is what the color MEANS, and the same rings answer five
  // different ones depending on that.
  // **Complexity, because it is the one lens that can draw a repo the moment it is opened.**
  // Surprise is the better reading and it is locked until somebody has run readers, so opening
  // on it meant the app's first frame was a grey map behind a lens that could not paint it.
  // See `MODE_LABEL`, where the same argument decides the menu order.
  const [mode, setMode] = useState<ColorMode>('tangle')
  /** How many rings the map draws — see `lib/rings.ts`. A display preference, so it is read
   *  from storage once and written back on every change, and it is NOT per project. */
  const [rings, setRings] = useState(loadRings)
  /** How much of each ring a directory's own band takes — see `Sunburst`'s `rimShare`, which
   *  carries the argument. Session state, not stored.
   *
   *  **A fifth, and the two ends are wrong in opposite directions.** At zero the rim is a few
   *  pixels and a container's distribution is drawn where nobody looks, with its flat mean
   *  behind: `sanity`'s `src-tauri` read as one shade of purple while the pane beside it showed
   *  2,660 / 1,693 / 3,663 / 14,727. At one the segments stop being arc LENGTHS and become
   *  areas — and area is the encoding this map already spends on lines, so a proportion
   *  silently turns into a quantity.
   *
   *  A fifth is enough to read four bands off a directory and little enough that the band is
   *  obviously a summary of the wedge rather than a measurement of its own.
   *
   *  **Fixed now, and the slider is gone.** It was there to be moved while the argument above
   *  was being had; it was had, on real repos, and nothing since has wanted a different
   *  number. */
  const band = BAND_SHARE
  /** The frame around a folder's band, the cut between two neighbours and the gutter between
   *  two levels — see `lib/spacing.ts`. A display preference like the ring count above, so it
   *  is read from storage once and written back on every change, and it is NOT per project.
   *
   *  **Fixed now, and the menu is gone — including its storage.** A hidden control still
   *  reading a stored value is worse than either having it or not: somebody who moved a slider
   *  once gets a map drawn to a decision they cannot see and cannot take back. The constant is
   *  the whole answer, and `loadSpacing`/`saveSpacing` have no caller. */
  const spacing = SPACING_DEFAULT
  /** Whether the folder rims carry Traps' and Clones' pointing marks — see `MarkerToggle`
   *  and `Sunburst`'s `dots`. On by default, because the mark is what makes those two lenses
   *  findable from the middle of the map; session state rather than stored, because it is a
   *  thing you turn off to look under the dots for a moment, not a way you keep the app.
   *  One flag for both lenses: they are the same mark in two colours, and a reader who turned
   *  it off on Clones did not mean "and leave it on when I look at Traps".
   *
   *  **Off by default now.** On, the rims carry a dot per thing found underneath before
   *  anybody has asked where to look — which is the map answering a question over the top of
   *  the one the lens is drawing. The marks are an aid to FINDING, and finding is something
   *  you start doing, so the switch beside the lens is where it starts. */
  const [markers, setMarkers] = useState(false)
  /** What Docs paints a doc that says nothing the code didn't — see `DerivableRead`. Session
   *  state, like the marks above: the other reading is something you switch to look again,
   *  not a way you keep the app.
   *
   *  **`none` by default, because `none` is the metric.** `reportGrades` counts a derivable
   *  doc as `none` whatever this says; `full` is the lens agreeing, for a moment, with the
   *  opinion that a complete description is documentation however obvious it was. */
  const [derivable, setDerivable] = useState<DerivableRead>('none')
  const chooseRings = useCallback((n: number) => {
    setRings(n)
    saveRings(n)
  }, [])
  /** How many colors each categorical lens spends — see `lib/palette.ts`. A display
   *  preference like the ring count, read once and written back on every change, and held
   *  per lens because the two lenses are asking different questions of it.
   *
   *  Both are loaded up front rather than the current one being loaded when the lens changes:
   *  the map is redrawn by the value, so a lens switch that had to go to storage first would
   *  paint one frame under the other lens's cap. */
  const [caps, setCaps] = useState<Record<Capped, number>>(() => ({
    blame: loadCap('blame'),
    language: loadCap('language'),
  }))
  const chooseCap = useCallback(
    (m: Capped) => (n: number) => {
      setCaps((c) => ({ ...c, [m]: n }))
      saveCap(m, n)
    },
    [],
  )
  /** Which of Age's two dates the lens paints — see `AgeRead`. Session state, not stored: it
   *  is a question you ask of the repo in front of you ("what here is dusty" against "what
   *  here moved lately"), not a way you keep the app. */
  const [ageRead, setAgeRead] = useState<AgeRead>('newest')
  /** Which of Blame's two reductions the map paints — see `BlameRead`. Session state, like
   *  the other lens readings: it says what a colour MEANS rather than what is drawn. */
  const [blameRead, setBlameRead] = useState<BlameRead>('touched')
  /** Which churn window the map is painted at — an index into this repo's own ladder, which
   *  is `Stats.churnWindows` and is NOT a constant. Session state: a horizon is something you
   *  change to look at the same repo differently, not a way you keep the app. */
  const [churnAt, setChurnAt] = useState(CHURN_DEFAULT_WINDOW)
  /** Which of Complexity's two readings the map paints — see `TangleRead`. Weighted by
   *  default, because "how complex it is FOR ITS SIZE" is the finding and the raw count is
   *  largely a restatement of the width the map already draws. Session state, like the rest of
   *  the lens sub-choices: something you switch to look again, not a way you keep the app. */
  const [tangleRead, setTangleRead] = useState<TangleRead>('weighted')

  return {
    mode,
    setMode,
    rings,
    chooseRings,
    band,
    spacing,
    markers,
    setMarkers,
    derivable,
    setDerivable,
    caps,
    chooseCap,
    ageRead,
    setAgeRead,
    blameRead,
    setBlameRead,
    churnAt,
    setChurnAt,
    tangleRead,
    setTangleRead,
  }
}

export function useLocks({
  replaying,
  tree,
  activeProject,
  readings,
  readingRev,
  scan,
}: {
  replaying: boolean
  tree: Node | null
  activeProject: ProjectSummary | null
  readings: RefObject<Held>
  readingRev: number
  scan: Scan | null
}) {
  /** The lens, replaying or not. **It used to be pinned to `age` while a replay was on
   *  screen**, and the switcher greyed with it — right about the four lenses a reading
   *  paints, and a blunt instrument for the rest, because a frame carries its own churn,
   *  age and language and could always have painted them. What a replay can and cannot
   *  show is `REPLAY`, one lens at a time; what it does about the ones it cannot is say so
   *  in the map rather than change what you are standing in. */
  /** Which lenses have nothing in them, and what would change that — see `Locked`.
   *
   *  **A lens with nothing to show is locked, not shown empty.** The first shape of this was
   *  a dimmed tab and a banner over the map; the second was the switcher greyed wholesale
   *  during a replay. Both made the user press something to find out. A lock is legible
   *  before the click, and its colour says whether a button exists that opens it.
   *
   *  Decided here because the answers come from three places — the project's readings, the
   *  repo's git history, this language's wiring — and the order matters: a replay's limits
   *  are true whatever the repo holds, so they are asked first.
   */
  const locks = useMemo(
    () =>
      locksFor({
        replaying,
        tree,
        assessed: activeProject?.assessed ?? 0,
        graded: gradedCounts(readings.current.list),
        traceDepth: activeProject?.trace_depth,
        tangleBands: scan?.stats.tangleBands ?? [],
        churned: scan?.stats.churned ?? false,
      }),
    // The stats it reads, which it used to read without depending on. `readingRev` because the
    // locks now count what the readings GRADE, and that moves when a reading lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [replaying, tree, activeProject, scan?.stats.tangleBands, scan?.stats.churned, readingRev],
  )
  return locks
}

/** The color slots every surface agrees on — the map, the rim, the legend, the panel, and the
 *  keys an export draws off screen. */
export function useRanks({
  filled,
  stack,
  focus,
  tree,
  scan,
  historyOn,
  history,
  historyKey,
  activeKey,
  drilled,
  viewMode,
  caps,
  ageSpan,
  ageRead,
  blameRead,
  tangleRead,
}: {
  filled: Node | null
  stack: string[]
  focus: Node | null
  tree: Node | null
  scan: Scan | null
  historyOn: boolean
  history: { tables: Tables; deltas: Deltas } | null
  historyKey: string | null
  activeKey: string | null
  drilled: string
  viewMode: ColorMode
  caps: Record<Capped, number>
  ageSpan: number | undefined
  ageRead: AgeRead
  blameRead: BlameRead
  tangleRead: TangleRead
}) {
  /** The rank lookup and the age span, memoised.
   *
   *  They were computed inline at two call sites, so every render walked the whole tree
   *  twice — and, being fresh objects, they defeated any memo on the components below.
   *  `Sunburst` renders every arc in the repo, so that is the difference between opening a
   *  dialog and rebuilding the map behind it. */
  /** **Ranked over what is on screen, not over the repo.** The eight slots go to the eight
   *  biggest categories, and which eight that is depends entirely on where you are standing:
   *  in `drivers/net/ethernet/broadcom` the repo's top eight authors are Alex Deucher and
   *  Jani Nikula and six others who have never touched it, so three colours were spent and
   *  the people who actually wrote the directory — 250 lines, 178 lines — were grey. A map
   *  that answers "who wrote this" with `other` for its own authors is not answering.
   *
   *  The cost is that an author is not promised one colour for the whole repo: drill in and
   *  the same person may take a different slot, or arrive from `other`. That is the right
   *  trade — the palette is eight slots deep against repos with thousands of authors, so a
   *  stable colour was never on offer past the top eight anyway, and what it bought was a
   *  drilled view coloured for somewhere else.
   *
   *  **A frame of a replay is not a drill, and that distinction is the memo below.** Both
   *  hand this a different tree; only one of them is a different QUESTION. */
  /** The same drill, resolved against TODAY rather than against the frame on screen.
   *
   *  A replay hands `focus` a different tree every commit, which is what `langRank` cannot
   *  be ranked over. Standing somewhere is a fact about the drill stack, so it can be asked
   *  of the live tree at any playhead; a path that does not exist at HEAD stops the walk and
   *  the ranking is the nearest live ancestor's, which is coarser and still stable. */
  const liveFocus = useMemo(() => {
    if (!filled) return null
    let node: Node = filled
    for (const id of stack) {
      const next = findById(filled, id)
      if (!next) break
      node = next
    }
    return node
  }, [filled, stack])

  /** Author → colour slot, ranked once over the whole log and used everywhere.
   *
   *  **It was two rankings, and the second one was a split brain nobody had named.** Replaying
   *  used `stats.authors`; standing still used the lines under your feet. Same people, same
   *  spelling, different slots — so opening History recoloured the entire cast, and the last
   *  frame of a story disagreed with the same repo sitting still. That is the invariant this
   *  now holds: **the end of the replay is the live map.** A story that arrives somewhere
   *  other than where you already were is not the same repo told forwards.
   *
   *  **Replaying, a person is an IDENTITY**, and three rules were tried before this that each
   *  went grey somewhere. Ranking every frame recoloured the cast as it ran. Seeding from
   *  today's ranking made the opening grey, because the people who start a repo are rarely its
   *  biggest by the end — ceph's `rgw` opened on six authors and drew `other (6)`. Assigning
   *  by arrival made the ENDING grey: the first sixteen held the palette forever and their
   *  lines are gone by 2026. All three derived identity from whatever happened to be visible.
   *  `stats.authors` is the whole repo's cast, ranked once over the whole log, so a person's
   *  place in it does not depend on the playhead — and now does not depend on the drill
   *  either.
   *
   *  **What this gives up is real and it was chosen with the cost in front of us.** Live, a
   *  person used to be a category of the picture in front of you: standing in one directory of
   *  kibana, its biggest authors are not the repo's, so a repo-wide order spends the named
   *  slots on people with nothing on screen. That argument was written when past the palette
   *  was one shared neutral, and it is why drilling recoloured. It no longer ends in grey —
   *  sixty-four colours recycling out to a thousand mean a drilled directory's people still
   *  get colours of their own, they just do not get NAMED in a legend that holds sixteen. A
   *  caption is the price now; it used to be the picture.
   *
   *  The remaining fallback is for a repo whose backend sent no cast at all — an older build,
   *  or one with no history — where ranking what is on screen is the only ranking there is.
   *  `langRank` still ranks over the drill: a language is genuinely a property of the code in
   *  front of you and there is no cast of them spanning a story, so the two lenses differ here
   *  on purpose rather than by neglect. */
  const authorRank = useMemo(() => {
    const cast = scan?.stats.authors ?? []
    if (cast.length > 0) return new Map(cast.map((name, i) => [name, i]))
    if (!liveFocus) return null
    const here = rankCategories(liveFocus, 'blame')
    return here.size > 0 ? here : null
  }, [scan, liveFocus])
  /** Language → colour slot, ranked over the VIEW but not over the FRAME.
   *
   *  **A language is a category of the picture in front of you and that is why it is ranked
   *  where you are standing** — six of them in this directory, the sixth of which matters —
   *  which is the one thing that stays different from `authorRank`. What a replay does is
   *  hand that ranking a new tree thirty times a second, so the mix shifts as the story runs
   *  and a file changes colour without changing language: the Blame lens was fixed for
   *  exactly this and Language was left animating its own legend.
   *
   *  A drill is a different question and a frame is not, so the scope is the drill and the
   *  tree is the LIVE one — the same map the ranking already had when History was pressed,
   *  which is what keeps entering a replay from recolouring anything.
   *
   *  **Today cannot rank what today has not got.** A repo that migrated off a language has
   *  no wedge at HEAD to rank it by, so its whole era would open in `other` — the mistake
   *  `authorRank` records from the other side. `historyLangs` supplies that tail, after
   *  everything the live map holds, so the live order is untouched and a vanished language
   *  still gets a colour of its own. */
  const langRank = useMemo(() => {
    if (!liveFocus) return undefined
    const m = rankCategories(liveFocus, 'language')
    const tables = historyOn && history && historyKey === activeKey ? history.tables : null
    if (tables) {
      let slot = m.size
      for (const lang of historyLangs(tables, drilled)) {
        if (!m.has(lang)) m.set(lang, slot++)
      }
    }
    return m
  }, [liveFocus, historyOn, history, historyKey, activeKey, drilled])

  const rankedNow = useMemo(() => {
    const at = focus ?? tree
    if (!at) return undefined
    // The fallback is the old behaviour, for a backend too old to send the list: ranking what
    // is on screen is wrong in a way somebody can see, where an empty map is not.
    //
    // **The cap is applied HERE and nowhere else.** Everything downstream — the wedges, the
    // rim, the panel's breakdown, the legend, the movie key — already agrees that a category
    // with no rank is `other`, so dropping the entries past the cap is the whole of what the
    // control has to do. See `capRanks`.
    const cap = isCapped(viewMode) ? caps[viewMode] : Infinity
    if (viewMode === 'blame' && authorRank) return capRanks(authorRank, cap)
    if (viewMode === 'language' && langRank) return capRanks(langRank, cap)
    return capRanks(rankCategories(at, viewMode), cap)
  }, [focus, tree, viewMode, authorRank, langRank, caps])
  /** A landed reading does not change who the eight biggest authors are, and the ranking is
   *  what the map, the rim, the legend and the panel are all memoised against. */
  const ranks = useSteady(rankedNow, sameRanks)
  /** Category → slot for any lens over `at`, capped like the map's own ranking.
   *
   *  **One copy, for everything that keys a lens off-screen** — the movie's key, the report's
   *  key and the report's bucket counts. Two copies of a ranking is how a key comes to name
   *  people the counts beside it filed under `other`. */
  const slotsFor = useCallback(
    (m: ColorMode, at: Node): Map<string, number> => {
      const cap = isCapped(m) ? caps[m] : Infinity
      return (
        (m === 'blame' && authorRank
          ? capRanks(authorRank, cap)
          : m === 'language' && langRank
            ? capRanks(langRank, cap)
            : capRanks(rankCategories(at, m), cap)) ?? new Map<string, number>()
      )
    },
    [authorRank, langRank, caps],
  )
  /** The key a movie carries, for whichever lens it is being recorded in.
   *
   *  **Built here because this is the side that knows the ranking.** `movie.ts` draws it into
   *  the caption column and resolves the colours against the staged map, so what crosses is
   *  custom-property NAMES and labels — never resolved values, which would come out in the
   *  ground the window happens to be wearing rather than the one the file is written on.
   *
   *  A movie needed no key while every replay was the age ramp with two flashes; it needs one
   *  now that a recording can be any lens the replay paints, because a Blame film is sixteen
   *  colours with nothing saying whose. */
  const keyAt = useCallback(
    (m: ColorMode, at: Node): MovieKey | null => {
      // Capped like the map's own ranking — a film is a recording of what was on screen, and
      // a key naming sixteen people over a picture drawing eight is the legend-disagrees-with-
      // the-map failure this file has already paid for twice.
      const slots = slotsFor(m, at)
      // **`lensKey`, the answer the key beside the map draws from.** This built its own and
      // knew two shapes — a ramp and a ranked cast — so Callers, Reach, Clones and Traps came
      // out with an empty key and Composition was coloured by rank rather than by kind.
      //
      // The whole calibration, because two lenses name their ramp's ends from it — see
      // `rampEnds`.
      return lensKey(
        m,
        {
          age: { span: ageSpan ?? AGE_DEFAULT.span, read: ageRead },
          churn: VIEWS_DEFAULT.churn,
          tangle: tangleRead,
          blame: blameRead,
          derivable: VIEWS_DEFAULT.derivable,
        },
        legendFor(at, m, blameRead),
        slots,
        m === 'blame' && holdsUncommitted(at, blameRead),
      )
    },
    [slotsFor, ageRead, blameRead],
  )

  return { authorRank, langRank, ranks, slotsFor, keyAt }
}

export function useLensViews({
  ageSpan,
  scan,
  ageRead,
  blameRead,
  tangleRead,
  churnAt,
  derivable,
}: {
  ageSpan: number | undefined
  scan: Scan | null
  ageRead: AgeRead
  blameRead: BlameRead
  tangleRead: TangleRead
  churnAt: number
  derivable: DerivableRead
}): Views {
  /** Both calibrated lenses as one value, so a caller cannot thread half of it — see `Views`.
   *  Memoised because `Sunburst` is a `memo` and a fresh object per render would make that
   *  memo do nothing. */
  const lensViews = useMemo<Views>(
    () =>
      viewsFor({
        ageSpan,
        churnWindows: scan?.stats.churnWindows,
        churned: scan?.stats.churned,
        ageRead,
        blameRead,
        tangleRead,
        churnAt,
        derivable,
      }),
    // **The stats it reads, not the scan it reads them off.** A landed reading replaces the
    // `Scan` to carry a new tree and leaves `stats` exactly where it was, so depending on the
    // scan handed a fresh `Views` to the map and the panel several times a minute during a
    // reading pass — a new object saying what the old one said, which is what every memo
    // below reads as a reason to rebuild.
    [ageSpan, ageRead, churnAt, tangleRead, blameRead, derivable, scan?.stats.churnWindows, scan?.stats.churned],
  )
  return lensViews
}
