import type { Progress, ProjectSummary } from './api'

/** Do two project lists say the same thing?
 *
 *  Field by field rather than by identity, because the poll that produces them allocates a
 *  new array of new objects every time regardless — identity can only ever say "different".
 *  Everything the sidebar draws is compared; anything not compared here is something the
 *  sidebar must not be showing. */
/** The wave, as far as anything on screen is concerned.
 *
 * **Its absence from the comparison froze the whole agent panel.** A run starting, a reader
 * spawning, `live` counting down to zero — none of it touches `assessed` or any other field
 * compared here, so the poll judged the list unchanged, kept the previous objects, and the
 * panel went on describing a run that had already finished. That is both halves of "it takes
 * a second to say WORKING" and "it takes forever to stop": the readers were long dead and
 * the numbers on screen were from whenever a reading last landed.
 *
 * Compared field by field rather than by identity, because the poll builds a fresh object
 * every tick — comparing references would be the same as not comparing at all, which is the
 * mistake `activeProject` already taught this file once. */
function sameRun(a: ProjectSummary['run'], b: ProjectSummary['run']): boolean {
  if (!a || !b) return a === b
  return (
    a.running === b.running &&
    a.stopping === b.stopping &&
    a.live === b.live &&
    a.spawned === b.spawned &&
    a.finished === b.finished &&
    a.failed === b.failed &&
    a.readers === b.readers &&
    a.ended === b.ended
  )
}

/** Two id lists, in order. Absent counts as empty — see the call site. */
function sameIds(a?: string[], b?: string[]): boolean {
  const x = a ?? []
  const y = b ?? []
  return x.length === y.length && x.every((id, i) => id === y[i])
}

/** Two progress reports, or two absences. `null` and a report are never the same thing: that
 *  transition is a trace starting or ending, which is the moment the row has to redraw. */
function sameProgress(a?: Progress | null, b?: Progress | null): boolean {
  if (!a || !b) return !a && !b
  return a.done === b.done && a.total === b.total && a.phase === b.phase && a.unit === b.unit
}

/** Fields whose equality is more than identity. Everything else compares with `Object.is`.
 *
 *  **A short list of exceptions, not a long list of inclusions**, and the difference is the
 *  whole point — see [`sameProjects`]. */
const DEEPLY: {
  [K in keyof ProjectSummary]?: (a: ProjectSummary[K], b: ProjectSummary[K]) => boolean
} = {
  reading: sameIds,
  run: sameRun,
  tracing: sameProgress,
  tracing_history: sameProgress,
  trace_cost: sameCost,
  scan_cost: sameCost,
  banked_models: (a, b) =>
    sameIds(
      a?.map((m) => `${m.model}:${m.readings}`),
      b?.map((m) => `${m.model}:${m.readings}`),
    ),
  // **The reading ticker, and it is `seq` alone by design.** Every entry is append-only and
  // stamped with a monotonic sequence, so the last one having the same number means nothing
  // behind it moved either. Comparing the whole array would be several hundred string
  // comparisons twice a second to learn what one integer already says.
  //
  // It carries its own weight here for a reason the old hand-written conjunction shows: this
  // field was not in it at ALL, and under a rule that compares whatever it finds, an
  // array freshly allocated by every poll is never equal to itself. That is not a missing
  // update, it is the opposite — the list would read as changed on every tick and re-render
  // every row forever, which during a replay is the periodic stutter `history.rs` is written
  // against. An exceptions list only works if the exceptions are actually all there.
  events: (a, b) =>
    (a?.length ?? 0) === (b?.length ?? 0) &&
    (a?.[a.length - 1]?.seq ?? -1) === (b?.[b.length - 1]?.seq ?? -1),
}

/** The two cost estimates, which are small flat objects and freshly allocated every poll. */
function sameCost(
  a?: { seconds: number; cold: boolean; fits: boolean } | null,
  b?: { seconds: number; cold: boolean; fits: boolean } | null,
): boolean {
  if (!a || !b) return !a && !b
  const n = (v: unknown) => (typeof v === 'number' ? v : null)
  return (
    a.seconds === b.seconds &&
    a.cold === b.cold &&
    a.fits === b.fits &&
    // `commits` on a trace cost, `files` on a scan cost — the one field that differs between
    // them, read structurally rather than by naming both.
    n((a as { commits?: number }).commits) === n((b as { commits?: number }).commits) &&
    n((a as { files?: number }).files) === n((b as { files?: number }).files)
  )
}

/** Has the project list actually changed?
 *
 *  The poll runs every 1.5s and `listProjects` allocates fresh objects each time, so storing
 *  the answer unconditionally re-renders every row — and during a replay that rebuilt several
 *  thousand arcs on a fixed period, which is the periodic stutter `history.rs` warns about.
 *  So the list is compared before it is stored.
 *
 *  **Every field this forgets is a number frozen on screen, and it forgot seven.** This was a
 *  hand-written conjunction of the fields somebody thought mattered, and it has now been wrong
 *  three times in the same way — twice recorded in its own comments, and once more for the
 *  whole of the trace: `tracing_history`, `trace_depth`, `trace_cost`, `resolved`, `resolvable`,
 *  `behind` and `scan_cost` were all absent, so a running trace fetched a fresh counter every
 *  tick, this said "same", the array was dropped, and the row showed the estimate it had been
 *  offered before anybody pressed anything. The pill stayed pressed for the same reason: it
 *  clears on the project object changing, and the project object never changed.
 *
 *  So it is not a list of fields any more. It walks whatever the row HAS and compares each key,
 *  which inverts the failure: a field added to `ProjectSummary` and forgotten here is now
 *  compared by default — at worst an extra re-render — where before it was silently ignored and
 *  froze on screen. Only the fields that need more than `Object.is` are named, in [`DEEPLY`],
 *  and those are the ones with a shape somebody would notice writing.
 *
 *  Keys from BOTH sides, because a backend that predates a field omits it: comparing only `a`'s
 *  keys would miss the tick where it first appears. */
export function sameProjects(a: ProjectSummary[], b: ProjectSummary[]): boolean {
  if (a.length !== b.length) return false
  return a.every((p, i) => {
    const q = b[i]
    if (!q) return false
    const keys = new Set([...Object.keys(p), ...Object.keys(q)]) as Set<keyof ProjectSummary>
    for (const k of keys) {
      const deep = DEEPLY[k] as ((x: unknown, y: unknown) => boolean) | undefined
      if (deep ? !deep(p[k], q[k]) : !Object.is(p[k], q[k])) return false
    }
    return true
  })
}
