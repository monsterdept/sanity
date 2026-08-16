/**
 * Where a launch's time goes, in the window's own clock.
 *
 * **Written because four rounds of backend measurement changed nothing a person could
 * feel.** The scan was made twenty times faster, the map cached, the cache made binary, the
 * decode trimmed to the seven thousand shapes that get drawn — and the app still took the
 * same beat to show a map, because the window was not asking for a second and a half. Timing
 * one side of a boundary tells you about that side.
 *
 * Marks are relative to the page's own start (`performance.now()` counts from navigation),
 * so a line reads as "this is when each thing happened", not as durations somebody has to
 * add up.
 *
 * Dev only, and once: this is an instrument for a question, not telemetry. It prints when the
 * first map reaches the screen and then goes quiet.
 */
const at = new Map<string, number>()
let done = false

export function mark(what: string): void {
  if (!import.meta.env.DEV || done || at.has(what)) return
  at.set(what, performance.now())
}

/** The first map is on screen. Print the line and stop. */
export function marked(): void {
  if (!import.meta.env.DEV || done) return
  done = true
  // A frame later, so "painted" is after the browser has actually drawn the arcs rather
  // than after React has finished handing them over.
  requestAnimationFrame(() => {
    at.set('painted', performance.now())
    const line = [...at].map(([k, t]) => `${k} ${Math.round(t)}ms`).join(' · ')
    console.log(`sanity: ${line}`)
  })
}
