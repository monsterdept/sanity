/**
 * The hub creature's clock, borrowed by the movie export.
 *
 * **A creature animates in wall-clock time, and an export does not.** The recording is not a
 * realtime capture — the file's clock is `f / FPS` however long the machine took to make the
 * frame, which is the whole reason a movie is the length it was asked for on any machine
 * (see `movie.record`). The creature was the one thing in the picture still living in real
 * time: thirty seconds of export compressed into a three-second file played its idle bob and
 * breath ten times too fast, and the faster the machine the worse it got.
 *
 * So during a recording the bundle's own animation loop is paused and it is advanced by
 * exactly one frame of the FILE per frame written. The creature then moves at true speed in
 * the export, and — the part that matters as much — the same repo exports the same movie
 * twice, because nothing in the picture depends on how long the picture took.
 *
 * **A module-level slot rather than a prop drilled to the exporter.** There is exactly one
 * creature in the hub, the export already reaches into the DOM for the map it copies and the
 * canvas it composites, and a callback threaded App → HistoryBar → dialog → `movie.ts` would
 * be four files carrying a function none of them calls. `MascotFigure` owns the handle and
 * registers here; the export asks. Registering `null` on unmount is what keeps a stale
 * closure over a disposed scene from being stepped.
 */
export interface MascotClock {
  /**
   * Take the creature off its own loop, and say whether that worked.
   *
   * False means the bundle cannot be driven — the committed placeholder, a scene that has
   * not built yet — and the caller must fall back to sampling whatever the creature happens
   * to be doing rather than freezing it. A held creature that is never stepped is a
   * photograph, which is worse than one moving too fast.
   */
  hold(): boolean
  /** Advance the creature by this many milliseconds and draw it. */
  step(ms: number): void
  /** Give it its own loop back. */
  release(): void
}

let current: MascotClock | null = null

/** Register the creature currently in the hub, or `null` on unmount. */
export function setMascotClock(clock: MascotClock | null): void {
  current = clock
}

/** The creature currently in the hub, if there is one to drive. */
export function mascotClock(): MascotClock | null {
  return current
}
