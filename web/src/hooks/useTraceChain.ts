import { useCallback, useRef, type Dispatch, type SetStateAction } from 'react'
import { listProjects, stopTrace, type ProjectSummary } from '../lib/api'
import { traceProject } from '../lib/history'
import { sameProjects } from '../lib/sameProjects'
// The pill's own answer to "what does pressing Trace do next" — see `chaseTrace`,
// which walks the column rather than re-deriving the ladder from `trace_depth`.
import { phasesOf } from '../components/Phases'

/** Where a trace has got to, as one string.
 *
 *  `chaseTrace`'s only test for "did that step accomplish anything". Every way a step can end
 *  without finishing its phase — the user pressed Stop, the walk hit a rewritten history, a
 *  blame pass banked short — comes back as this being unchanged, and one press must never turn
 *  into a loop that keeps restarting a pass somebody just stopped. Cheaper and more honest than
 *  asking each phase how it ended: a phase that made no progress has nothing to chain to,
 *  whatever the reason was. */
function traceSig(p: ProjectSummary): string {
  return `${p.trace_depth}|${p.resolved}/${p.resolvable}|${p.replayed}/${p.commits}`
}

/** A project row's Trace pill, run as one column — see `chaseTrace` — plus its two other
 *  entries: replay from scratch, and Stop. */
export function useTraceChain({
  projects,
  setProjects,
  refreshProjects,
  replay,
  setError,
}: {
  projects: ProjectSummary[]
  setProjects: Dispatch<SetStateAction<ProjectSummary[]>>
  refreshProjects: () => void
  replay: (key: string, repo: string, fresh?: boolean) => Promise<void>
  setError: Dispatch<SetStateAction<string | null>>
}) {
  /** Which projects have a trace column being walked. Keyed, and that is the point.
   *
   *  **It was one slot, and one slot is a rule about the APP where the constraint is about a
   *  project.** Two repos can be traced at once — `TraceState.stop` is per project for exactly
   *  that reason — and only the replay is one-at-a-time, which `walking` guards on its own. A
   *  single slot meant a chain on kibana, which is minutes of blame, silently swallowed the
   *  press on every other row: no error, no busy pill, nothing. A guard that refuses work has
   *  to refuse the work it was written about, or it becomes a dead button somewhere else. */
  const chasing = useRef<Set<string>>(new Set())
  /** Projects whose chain has been asked to stop. Checked between phases, so a stopped blame
   *  pass does not roll straight on into an hour of replay — a Stop means the column, not just
   *  the step. Keyed for the same reason `chasing` is: stopping one repo is not stopping all of
   *  them, and a shared flag would have quietly ended somebody else's walk. */
  const stopChase = useRef<Set<string>>(new Set())

  /** Walk this repo's commits, from the project row's `Trace`.
   *
   *  **It does not take the view.** Tracing takes an hour on a large repo and it is work
   *  asked of a project, not a place to go: pressing it used to select that project and then
   *  drop the window into History when the walk finished, so a button on one row rearranged
   *  what somebody was looking at on another. The row it was pressed on reports the progress
   *  and offers the way out, which is where a background job belongs. */
  /** Read a repo's commit log onto the map — depth 1, the ask the budget declined.
   *
   *  **Not the replay.** `trace` below walks every commit to build a timeline; this reads the
   *  log once so every wedge gains an age, a churn and an author. They share a word because
   *  they are the same instrument at two depths — see `trace.rs` — and they share nothing
   *  else: this one is seconds to a minute, and the map it lands on is already drawn.
   *
   *  The projects poll is what refreshes the row; the tree refetch is what repaints the map,
   *  and it has to be asked for here because `scanned` moving is the only signal the window
   *  gets and a trace bumps it from a call it made itself. */

  /** Press `Trace` once and get the whole column.
   *
   *  **The three depths are one ask.** `trace.rs` reads history in three sizes — the commit
   *  log, then per-line blame, then every commit replayed into a timeline — and the pill has
   *  always been one column saying `Trace` for all three, on the argument that a button which
   *  renames itself mid-sequence reads as a new button that has appeared. That argument was
   *  right about the label and left the sequence in the same place: the same word in the same
   *  sixty pixels had to be pressed three times, with nothing on screen saying so, and the
   *  second press looked like the first one had failed.
   *
   *  So a press means the column rather than the step. It runs each phase in turn, checking
   *  the backend's own state between them and stopping the moment a step reports no progress —
   *  which is what a Stop looks like from here (see `traceSig`).
   *
   *  **The steps stay separate underneath, and that is deliberate.** Chaining lives here, in
   *  the one place three phases are drawn as one control; `trace_project` and `scan_history`
   *  are still two commands doing one depth each, because the CLI's `sanity trace` and the MCP
   *  endpoint are separate asks and must not inherit a sequence nobody typed.
   *
   *  What a press does NOT do is escape the budget: it is an explicit ask, so it runs whatever
   *  it was pointed at — and the replay on a large repo is an hour where the log walk was a
   *  minute. Every phase remains stoppable at its own granularity, the depth reached is banked
   *  either way, and the note under the pill names the phase that is running. */
  const chaseTrace = useCallback(
    (key: string) => {
      // One column at a time. A second press while this is walking is somebody asking again
      // for what is already happening, and the pill has gone busy to say so.
      // A second press on the row already walking is somebody asking again for what is
      // happening. Another row is a different question and gets its own chain.
      if (chasing.current.has(key)) return
      chasing.current.add(key)
      stopChase.current.delete(key)
      const run = async () => {
        for (;;) {
          const list = await listProjects()
          setProjects((prev) => (sameProjects(prev, list.projects) ? prev : list.projects))
          const p = list.projects.find((x) => x.key === key)
          if (!p || stopChase.current.has(key)) return
          // **`phasesOf` decides what comes next, not a second copy of the ladder here.** The
          // pill already resolves a project row into "the trace phase's outstanding action",
          // and working that out again from `trace_depth` and `resolved` is the two-answers
          // problem `PhaseAction` exists to prevent — with the unwatched copy free to go wrong.
          const act = phasesOf(p).find((ph) => ph.key === 'trace')?.act
          const before = traceSig(p)
          if (act === 'replay') {
            // **The last third, and the chain ends on it whatever happens.** There is nothing
            // after the replay to chain to, so a completed one has no next step and a
            // CANCELLED one must not be handed straight back to itself — a partial walk is
            // banked and extended, so its counter has moved and every "did that accomplish
            // anything" test would say yes. Pressing Trace again resumes it, which is the
            // explicit ask that step deserves.
            await replay(key, p.repo)
            return
          }
          if (act !== 'trace') return
          await traceProject(p.repo)
          const after = await listProjects()
          setProjects((prev) => (sameProjects(prev, after.projects) ? prev : after.projects))
          const now = after.projects.find((x) => x.key === key)
          if (!now || traceSig(now) === before) return
        }
      }
      void run()
        .catch((err) => setError(String(err)))
        .finally(() => {
          chasing.current.delete(key)
          refreshProjects()
        })
    },
    [refreshProjects, replay],
  )

  /** Replay this repo from scratch, for the row's context menu.
   *
   *  The one entry that is NOT the chain: "replay from scratch" is a deliberate re-walk of a
   *  timeline that already exists, so it names its own step rather than asking what is
   *  outstanding — which is nothing. */
  const trace = useCallback(
    (key: string, fresh = false) => {
      const repo = projects.find((p) => p.key === key)?.repo
      if (!repo) return
      void replay(key, repo, fresh).catch((e) => setError(String(e)))
    },
    [projects, replay],
  )

  /** The row's Stop. */
  const stopChain = (key: string) => {
    // The chain first: a blame pass that is asked to stop must not have the next
    // phase started for it half a second later. Stopping one step of a sequence
    // somebody set going means the sequence.
    stopChase.current.add(key)
    const repo = projects.find((p) => p.key === key)?.repo
    if (repo) void stopTrace(repo).catch((err) => setError(String(err)))
  }

  return { chaseTrace, trace, stopChain }
}
