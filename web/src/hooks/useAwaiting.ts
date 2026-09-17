import { useMemo } from 'react'
import type { Progress, ProjectSummary } from '../lib/api'
import { shapeTree, type ShapeFile } from '../lib/shape'

/** Files that have to have arrived before the assembling map is drawn — see `shapeRoot`. */
const SHAPE_FLOOR = 24

/** What the pane is waiting on when there is no map yet: which project, how far its scan has
 *  got, and the map assembling out of it. */
export function useAwaiting({
  projects,
  activeKey,
  activeProject,
  shape,
  streamingKey,
}: {
  projects: ProjectSummary[]
  activeKey: string | null
  activeProject: ProjectSummary | null
  shape: ShapeFile[]
  streamingKey: string | null
}) {
  /** The selected project when it is still being rescanned by the startup restore, so the
   *  pane can show its progress instead of the copy for someone who has no projects. */
  const loadingProject = useMemo(
    () => projects.find((p) => p.key === activeKey && p.loading) ?? null,
    [projects, activeKey],
  )

  /** The project the empty pane is waiting on, whether or not one has been selected yet.
   *
   *  A launch has a window between "the list has arrived" and "a tree has been built from
   *  one of them", and during it nothing was selected — so the pane fell through to the
   *  first-run card and told somebody with three projects to go and study their first. A
   *  list with anything in it is never that state; the honest answer is which project is
   *  being read. `projects[0]` because the restore takes them in order and the pane is
   *  naming a wait, not addressing a selection. */
  const awaiting = useMemo(
    () => loadingProject ?? (projects.length > 0 ? (activeProject ?? projects[0]) : null),
    [loadingProject, projects, activeProject],
  )

  const awaitingKey = awaiting?.key ?? null

  /** The assembling map, or nothing until enough of it has arrived to be worth drawing.
   *
   *  The threshold is not politeness — a sunburst of one directory is a solid disc, and
   *  watching the repo appear only works if what appears first is recognisably a repo.
   *  Below it the pane keeps the wait it already had. */
  const shapeRoot = useMemo(
    () =>
      // Only for the repo it is OF. The accumulated shape outlives the scan that produced
      // it — nothing clears it until another repo starts streaming — so without this a
      // project that arrives with no shape of its own would be handed the last one's, drawn
      // under its own name: a map of the wrong repo, and nothing on screen saying so.
      shape.length >= SHAPE_FLOOR && awaitingKey !== null && streamingKey === awaitingKey
        ? shapeTree(shape, awaiting?.name ?? 'repo')
        : null,
    // The two FIELDS, never the object: `awaiting` is rebuilt by every poll, and this
    // memo folds 45,000 files. Depending on the object would rebuild the whole tree
    // 1.5 seconds apart for the length of a scan — the same trap the frame tree fell into.
    [shape, awaitingKey, awaiting?.name, streamingKey],
  )

  /** The awaited scan's own progress, built once for both the things that show it.
   *
   *  **The map assembling is not the same news as how far along the scan is, and it stopped
   *  being enough on its own.** The pane and the assembling map were alternatives — a bar
   *  until there was a picture, then the picture and nothing else — which was right while
   *  the parse was the whole wait. It is not: the parse of linux finishes at 45k files with
   *  the rings fully drawn, and the blame pass then runs for hours behind a map that looks
   *  finished and says nothing. So they are not alternatives; the strip rides over the map.
   */
  const awaitingProgress: Progress | null = useMemo(
    () =>
      awaiting?.loading && awaiting.read_total > 0
        ? {
            done: awaiting.read_done,
            total: awaiting.read_total,
            // Carried, not dropped. Rebuilding a `Progress` from the two numbers the row
            // happened to need is how the pane came to print a count with no idea what
            // phase produced it or what it counted.
            phase: awaiting.read_phase,
            unit: awaiting.read_unit,
          }
        : null,
    [awaiting],
  )

  return { awaiting, shapeRoot, awaitingProgress }
}
