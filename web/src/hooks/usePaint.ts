import { useMemo } from 'react'
import { ageSpanOf, type ColorMode } from '../lib/colorMode'
import type { LensChoices } from './useLens'
import { useLensViews, useLocks, useRanks } from './useLens'
import type { Overlays } from './useOverlays'
import type { Project } from './useProject'
import type { MapView, Standing } from './useMap'
import { useReport } from './useReport'
import { useMovieSource } from './useHistory'
import { useLensKeys } from './useLensKeys'

/** How the tree on screen is painted — the lens layer, which takes the tree and says nothing
 *  about which one it is.
 *
 *  Which lenses the repo can answer; the ranks behind every categorical lens and each lens's
 *  reading of its own scale; and what the two exports take from the same paint: the report,
 *  and the movie, which paints the replay's frames with these ranks and this look. The
 *  keyboard is here because nearly all it does is choose a lens. */
export function usePaint(
  choices: LensChoices,
  { stack, historyOn }: Pick<Standing, 'stack' | 'historyOn'>,
  overlays: Pick<Overlays, 'finding' | 'setFinding' | 'helping' | 'findingsOpen' | 'reporting' | 'setReporting'>,
  { scan, readings, readingRev, activeKey, activeProject }: Pick<
    Project,
    'scan' | 'readings' | 'readingRev' | 'activeKey' | 'activeProject'
  >,
  { filled, focus, tree, hist, drilled, activeRef, treeRef, toggleHistory }: Pick<
    MapView,
    'filled' | 'focus' | 'tree' | 'hist' | 'drilled' | 'activeRef' | 'treeRef' | 'toggleHistory'
  >,
) {
  const { mode, setMode, caps, ageRead, blameRead, tangleRead, churnAt, derivable, rings, spacing, band, markers } =
    choices
  const locks = useLocks({ replaying: hist.replaying, tree, activeProject, readings, readingRev, scan })

  /** What the map is actually painted with.
   *
   *  **The lens you chose. A locked one included.**
   *
   *  This substituted `language` for a lens the repo cannot answer, and the substitution was
   *  the last survivor of a rule this app has otherwise abandoned everywhere: the strip is
   *  click-through, the menu dims a locked row rather than disabling it, `lib/keys.ts` refuses
   *  to let the keyboard turn a digit down — all three on the ground that *a locked lens is
   *  still a place you can stand, and what it has to say there is said by the map*. It could
   *  not be, while standing on one silently put you somewhere else: ⌘2 on an unread repo
   *  selected Surprise and landed on Language, with the chip, the key and the panel all
   *  agreeing that Language was what you had asked for. A shortcut that answers with a
   *  different lens is worse than one that does nothing, because nothing about the screen
   *  afterwards says a substitution happened.
   *
   *  What a locked lens paints is an absence, which every lens here already knows how to
   *  draw: no reading is grey, an unresolved language is grey, a repo with no history is
   *  grey. Why it is grey is the LOCK's job — the padlock on the chip, and the sentence in
   *  its tooltip beside the button that opens it. That is the one place a repo-level answer
   *  belongs, and `ColorKey` has been drawing it on the trigger all along; nothing could
   *  reach that state to see it.
   *
   *  **Replaying or not.** It used to be pinned to `age` while a replay was on
   *  screen, and the switcher greyed with it — right about the four lenses a reading
   *  paints, and a blunt instrument for the rest, because a frame carries its own churn,
   *  age and language and could always have painted them. What a replay can and cannot
   *  show is `REPLAY`, one lens at a time; what it does about the ones it cannot is say so
   *  in the map rather than change what you are standing in. */
  const viewMode: ColorMode = mode

  /** The repo's own span for the age ramp. Never consulted during a replay: a frame's
   *  colour is a flare measured in commits, not a position on this scale — see
   *  `Score.recency`. */
  const ageSpan = useMemo(() => (tree ? ageSpanOf(tree) : undefined), [tree])
  const { authorRank, langRank, ranks, slotsFor, keyAt } = useRanks({
    filled,
    stack,
    focus,
    tree,
    scan,
    historyOn,
    history: hist.history,
    historyKey: hist.historyKey,
    activeKey,
    drilled,
    viewMode,
    caps,
    ageSpan,
    ageRead,
    blameRead,
    tangleRead,
  })
  const { reportLangs, completeTree } = useReport({
    filled,
    activeRef,
    treeRef,
    readings,
    reporting: overlays.reporting,
    setReporting: overlays.setReporting,
  })
  const lensViews = useLensViews({ ageSpan, scan, ageRead, blameRead, tangleRead, churnAt, derivable })
  const { movieSource, setPaneSide } = useMovieSource({
    history: hist.history,
    historyKey: hist.historyKey,
    activeKey,
    projectName: activeProject?.name,
    drilled,
    flashes: hist.flashes,
    churnWindows: hist.churnWindows,
    stack,
    slotsFor,
    keyAt,
    lensViews,
    rings,
    spacing,
    band,
    markers,
    headOrder: hist.headOrder,
  })
  useLensKeys({
    toggleHistory,
    finding: overlays.finding,
    findingsOpen: overlays.findingsOpen,
    helping: overlays.helping,
    setFinding: overlays.setFinding,
    mode,
    setMode,
  })

  return {
    locks,
    viewMode,
    authorRank,
    langRank,
    ranks,
    slotsFor,
    reportLangs,
    completeTree,
    lensViews,
    movieSource,
    setPaneSide,
  }
}

export type Paint = ReturnType<typeof usePaint>
