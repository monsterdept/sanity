import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import {
  agentReports,
  applyAgentReports,
  holdReadings,
  NO_READINGS,
  type AgentReport,
  type Held,
  type Scan,
} from '../lib/api'

/** Readings, kept so a function ring can carry them the moment it lands.
 *
 *  **A tree arrives without its functions** — see `Node::slim` — so `applyAgentReports`
 *  folds readings into a tree that has none, and the rings turn up afterwards from
 *  `fileFunctions` holding raw scan nodes. Nothing re-applied to those, so every function
 *  reading was invisible on the map while the status line reported 69.9% read. `filled` is
 *  the only place they can meet, and this is how they get there.
 *
 *  A ref plus a revision counter rather than state, on the same argument `treeRev` makes:
 *  the poll refetches every reading every two seconds, and a new Map each time would
 *  invalidate the graft's memo on a fixed period and re-lay the sunburst out for nothing.
 *  The counter moves only when `holdReadings` says something changed. */
export function useReadings() {
  const readings = useRef<Held>(NO_READINGS)
  const [readingRev, setReadingRev] = useState(0)
  /** What to fold, and whether folding it can change anything — see `holdReadings`, which is
   *  where the readings that did not move are given back the objects they already had. */
  const keepReadings = useCallback((list: AgentReport[]) => {
    const { held, moved } = holdReadings(readings.current, list)
    if (!moved) return { list: readings.current.list, moved: false }
    readings.current = held
    setReadingRev((n) => n + 1)
    return { list: held.list, moved: true }
  }, [])
  return { readings, readingRev, keepReadings }
}

// Agents report over MCP while the app is open, so the map has to pick their verdicts
// up without a rescan. Polled on a slow timer: an agent takes seconds per function, so
// this costs nothing and avoids pushing events out of the loopback server.
//
// Except during a replay, where it costs a great deal. The readings are fetched WHOLE —
// 16,925 of them on tonepoet — and folded into the live tree, which is not the tree on
// screen while history is playing. At three hundred commits a second two seconds is
// several hundred frames, so the picture stuttered on a fixed period and the period was
// this timer. Nothing is lost by waiting: readings are recovered on the next tick after
// history closes, and the live map is not being looked at meanwhile.
//
export function useReadingsPoll({
  activeKey,
  historyOn,
  keepReadings,
  setScan,
}: {
  activeKey: string | null
  historyOn: boolean
  keepReadings: (list: AgentReport[]) => { list: AgentReport[]; moved: boolean }
  setScan: Dispatch<SetStateAction<Scan | null>>
}) {
  useEffect(() => {
    const timer = setInterval(() => {
      if (historyOn) return
      void agentReports(activeKey).then((reports) => {
        if (reports.length === 0) return
        // **Nothing new is nothing to do.** The fold was run on every tick regardless, and
        // even a fold that changed no wedge returned a new `Scan` — which is the object the
        // whole picture is memoised against, so the map and the panel were rebuilt twice a
        // minute for a poll that had learned nothing. `moved` is the signature saying so.
        const { list, moved } = keepReadings(reports)
        if (!moved) return
        setScan((prev) => {
          if (!prev) return prev
          const root = applyAgentReports(prev.root, list)
          // A reading can move without moving a wedge — a re-read that graded the same, or
          // one for a function this tree has not been sent. Then the tree is the tree it
          // already was, and saying so is the difference between an update and a redraw.
          return root === prev.root ? prev : { ...prev, root }
        })
      })
    }, 2000)
    return () => clearInterval(timer)
  }, [activeKey, historyOn, keepReadings])
}

/** Node ids a reader holds a lease on right now, for the map's pulse — see the comment inside,
 *  which is why a file lights as well as the function in it. Keyed on the ids' CONTENT, so a
 *  poll handing back the same leases in a fresh array does not hand the map a fresh Set. */
export function useReadingLeases(readingIds: string[] | undefined): Set<string> {
  const readingKey = readingIds?.join('\u0000') ?? ''
  const readingNow = useMemo(() => {
    const ids = readingKey ? readingKey.split('\u0000') : []
    // **The containing FILE goes in too, and without it the pulse was invisible.** A
    // function wedge on a real repo is a fraction of a degree, and past the ring's budget it
    // is not drawn at all — folded into a roll-up — so a marker on it lit nothing you could
    // see and sometimes nothing that existed. A file always has its own band.
    //
    // One Set for both because a file node's id IS its path, and a function's is
    // `path#name`, so the prefix of a reading id is exactly the id of the file to light.
    // Directories deliberately stay dark: at the root they are most of the picture, and a
    // marker covering half the map says nothing about where the work is.
    return new Set(ids.flatMap((id) => [id, id.split('#')[0]]))
  }, [readingKey])
  return readingNow
}
