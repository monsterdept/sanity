import { useMemo, useRef, useState } from 'react'
import type { Node } from '../lib/api'
import { pruneExcluded } from '../lib/api'
import { findById } from '../lib/tree'
import type { Overlays } from './useOverlays'
import type { Project } from './useProject'
import { useHistory, useHistoryScope } from './useHistory'
import { useTraceChain } from './useTraceChain'
import { useRingFetch, useRingGraft } from './useRings'

/** Where the reader is standing in the tree: the drill stack, the picked wedge, and whether
 *  the replay is up.
 *
 *  **Held apart from `useMap`, and before the project, because a project switch is what moves
 *  them.** Arriving at a repo restores its drill-in and drops the selection — see
 *  `useProjects`' view store — and the reading poll stands down during a replay, so the
 *  project layer has to be handed all three before the tree it draws exists. None of them
 *  has an input. */
export function useStanding() {
  const [stack, setStack] = useState<string[]>([])
  /** What is selected, as the NODE rather than its id.
   *
   *  It was an id, resolved against the tree on every render — which quietly cannot
   *  represent the one selection that is not in the tree. The overflow aggregate a file's
   *  band collapses into is synthesised at layout time, so `findById` returned null for
   *  it and clicking it emptied the panel instead of describing it. The id is still used
   *  first, so a rescan re-resolves the selection to the fresh node; the stored object is
   *  the fallback for anything the tree does not contain. */
  const [picked, setPicked] = useState<Node | null>(null)
  /** Whether the replay is up. The window's, not `useHistory`'s: the reading poll and the
   *  findings ask stand down while it is set — see `useHistory` for what History is. */
  const [historyOn, setHistoryOn] = useState(false)
  return { stack, setStack, picked, setPicked, historyOn, setHistoryOn }
}

export type Standing = ReturnType<typeof useStanding>

/** Which tree is on screen, and where it is rooted.
 *
 *  The replay's frame while one is up, the scan otherwise — pruned of what `.sanityignore` set
 *  aside and grafted with the function rings as they arrive — and `focus`, the wedge the drill
 *  stack resolves to inside it. The replay is here whole, with the trace chain that feeds it
 *  and the scope its transport follows, because while it runs the frame IS the tree. */
export function useMap(
  { stack, historyOn, setHistoryOn, setPicked }: Pick<Standing, 'stack' | 'historyOn' | 'setHistoryOn' | 'setPicked'>,
  { codeFile }: Pick<Overlays, 'codeFile'>,
  {
    scan,
    setError,
    readings,
    readingRev,
    treeRev,
    projects,
    setProjects,
    refreshProjects,
    activeKey,
    activeProject,
    repoPath,
  }: Pick<
    Project,
    | 'scan'
    | 'setError'
    | 'readings'
    | 'readingRev'
    | 'treeRev'
    | 'projects'
    | 'setProjects'
    | 'refreshProjects'
    | 'activeKey'
    | 'activeProject'
    | 'repoPath'
  >,
) {
  /** Where the map is rooted, as a path, taken straight from the drill stack.
   *
   *  `focus` is the same answer resolved against the tree — and the tree is what this is
   *  handed to, so asking `focus` here would be a cycle. Container ids ARE their paths,
   *  which is what makes the stack usable directly; `''` is the repo. */
  const drilled = stack.length > 0 ? stack[stack.length - 1] : ''

  /** The replay, whole — see `useHistory`. Held as the one object it returns rather than taken
   *  apart, because nearly every surface of the window reads some part of it. */
  const hist = useHistory({
    historyOn,
    setHistoryOn,
    repoPath,
    activeKey,
    projectName: activeProject?.name,
    setError,
    scan,
    drilled,
  })
  const { chaseTrace, trace, stopChain } = useTraceChain({
    projects,
    setProjects,
    refreshProjects,
    replay: hist.replay,
    setError,
  })

  /** What the map is drawing: the frame when history is on, the scan otherwise.
   *
   *  Pruned of everything `.sanityignore` set aside — see `pruneExcluded`. Done here rather
   *  than in Rust so the counts, which walk the scan's own tree, go on counting what was set
   *  aside: the exclusion is still reported, it is just not drawn.
   *
   *  Memoised on the scan rather than computed per render: it is a walk of every node, and
   *  every navigation below reads this. */
  const drawn = useMemo(() => (scan ? pruneExcluded(scan.root) : null), [scan])
  // **Before `useRingFetch`, and before `useNavigation`.** Its effect empties `asked` and
  // `landed` when a tree arrives; both of those effects then add to them in the same commit.
  // Run after them, the clear would throw away the requests they had just put in flight.
  const { filled, fns, wanted, wantRings, asked, landed, activeRef } = useRingGraft({
    drawn,
    readings,
    readingRev,
    activeKey,
    treeRev,
  })

  const tree = hist.histRoot ?? filled
  /** The tree where a CALLBACK can read it.
   *
   *  A handler that closes over the tree is rebuilt every time the tree is, which during a
   *  reading pass is every time a reading lands — and a new function identity is what every
   *  memoised child reads as "your props changed". These handlers do not care WHICH tree they
   *  are given: they are read at the moment somebody clicks, and what is wanted then is
   *  whatever is on screen. Same argument `scanRef` and `activeRef` make, one level up. */
  const treeRef = useRef<Node | null>(null)
  treeRef.current = tree

  // The wedge the sunburst is currently rooted at, resolved by id every render so a
  // rescan keeps the user where they were rather than throwing them back to the top.
  const focus = useMemo(() => {
    if (!tree) return null
    let node: Node = tree
    for (const id of stack) {
      const next = findById(tree, id)
      if (!next) break
      node = next
    }
    return node
  }, [tree, stack])

  const { toggleHistory, scope, frames } = useHistoryScope({
    historyOn,
    setHistoryOn,
    setPlaying: hist.setPlaying,
    setPicked,
    focus,
    tree,
    historyBusy: hist.historyBusy,
    replayed: activeProject?.replayed,
    history: hist.history,
    repoPath,
  })
  useRingFetch({ activeKey, focus, codeFile, fns, wanted, asked, landed, activeRef })

  return {
    drilled,
    hist,
    chaseTrace,
    trace,
    stopChain,
    filled,
    wantRings,
    asked,
    landed,
    activeRef,
    tree,
    treeRef,
    focus,
    toggleHistory,
    scope,
    frames,
  }
}

export type MapView = ReturnType<typeof useMap>
