import { useRef, useState } from 'react'
import type { Scan } from '../lib/api'
import { mark } from '../lib/stopwatch'
import type { LensChoices } from './useLens'
import type { Overlays } from './useOverlays'
import type { Standing } from './useMap'
import { useProjects } from './useProjects'
import { useReadingLeases, useReadings, useReadingsPoll } from './useReadings'
import { useScanStream } from './useScanStream'
import { useAddProject } from './useAddProject'
import { useAwaiting } from './useAwaiting'
import { useFindings } from './useFindings'
import { useRemote } from './useRemote'

/** Which repo is open and what is known about it — the first layer of the window, and the only
 *  one that talks to the backend about WHICH project.
 *
 *  The projects the sidebar lists and the one on screen; the scan that arrived for it and the
 *  readings folded into it, with the poll that keeps them current; the leases readers hold on
 *  it right now; the shape streaming in while it is being built, and what the pane says while
 *  it waits; adding one by hand; its findings and the remote it is known by; and the error any
 *  of that last said.
 *
 *  It is handed the lens and where you stand because a project switch banks and restores them
 *  — see `useProjects`' view store — and the overlays because adding a repo can ask first. */
export function useProject(
  { mode, setMode }: Pick<LensChoices, 'mode' | 'setMode'>,
  { stack, setStack, setPicked, historyOn }: Pick<Standing, 'stack' | 'setStack' | 'setPicked' | 'historyOn'>,
  { setBigFolder, setBigHistory, openFindings }: Pick<Overlays, 'setBigFolder' | 'setBigHistory' | 'openFindings'>,
) {
  const [scan, setScan] = useState<Scan | null>(null)
  /** Ticks when a tree ARRIVES from the backend — a different project, a rescan, or none.
   *
   *  **Not the same event as `scan` changing.** Readings are folded INTO
   *  the tree on screen, which produces a new object for the same repo several times a
   *  minute; a tree arriving is a different repo, or the same one rebuilt. The two are
   *  indistinguishable by identity and have opposite consequences for anything cached
   *  against the tree — see the effect that drops the function rings. */
  const [treeRev, setTreeRev] = useState(0)
  const { readings, readingRev, keepReadings } = useReadings()
  const [error, setError] = useState<string | null>(null)
  /** Whether a tree is on screen, for the poll — which cannot read state it is not
   *  re-created with. Assigned during render: the poll reads it in an answer that lands
   *  later, so any point in the render is early enough. */
  const scanRef = useRef<Scan | null>(null)
  scanRef.current = scan
  if (scan) mark('scan')

  const {
    projects,
    setProjects,
    activeKey,
    projectsLoaded,
    activeProject,
    repoPath,
    setPendingAdd,
    refreshProjects,
    forget,
    reset,
    select,
    scanKey,
  } = useProjects({
    mode,
    stack,
    setMode,
    setStack,
    setPicked,
    keepReadings,
    scanRef,
    setScan,
    setTreeRev,
    setError,
  })
  useReadingsPoll({ activeKey, historyOn, keepReadings, setScan })
  const { shape, streamingKey, live, shapeSort } = useScanStream()
  const { addProject, takeFolder } = useAddProject({ setError, setPendingAdd, setBigFolder, setBigHistory })
  const readingNow = useReadingLeases(projects.find((p) => p.key === activeKey)?.reading)
  const { awaiting, shapeRoot, awaitingProgress } = useAwaiting({
    projects,
    activeKey,
    activeProject,
    shape,
    streamingKey,
  })
  const findings = useFindings({
    activeKey,
    treeRev,
    assessed: activeProject?.assessed,
    historyOn,
    openFindings,
  })
  const remote = useRemote(repoPath)

  return {
    scan,
    treeRev,
    readings,
    readingRev,
    error,
    setError,
    projects,
    setProjects,
    activeKey,
    projectsLoaded,
    activeProject,
    repoPath,
    refreshProjects,
    forget,
    reset,
    select,
    scanKey,
    live,
    shapeSort,
    addProject,
    takeFolder,
    readingNow,
    awaiting,
    shapeRoot,
    awaitingProgress,
    findings,
    remote,
  }
}

export type Project = ReturnType<typeof useProject>
