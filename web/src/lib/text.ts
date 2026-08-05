/**
 * Shorten from the middle, keeping both ends.
 *
 * Paths are long and the places they are shown are narrow, so the choice is wrapping or
 * eliding. Wrapping loses on both counts: `break-all` splits the last token wherever it
 * happens to land — `Store.swif` / `t:1672` — destroying the filename and line, which are
 * the two things anyone reads a path for, and a wrapped path pushes everything under it
 * down by a line that carries no information.
 *
 * Weighted to the tail for the same reason: the leading directories orient you and are
 * usually inferable from what you clicked, while the end is the answer. Safe to count in
 * characters rather than measure pixels because every caller sets these in the monospace
 * face.
 */
export function elide(s: string, max: number): string {
  if (s.length <= max) return s
  const tail = Math.ceil((max - 1) * 0.65)
  const head = Math.max(1, max - 1 - tail)
  return `${s.slice(0, head)}…${s.slice(s.length - tail)}`
}
