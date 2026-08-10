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

/**
 * A count that fits, with a unit only once the digits stop fitting.
 *
 * The header sits in a 290px column and prints three of these on one line, so a repo with
 * a million lines would wrap where a repo with ten thousand does not — and a line that
 * reflows depending on the project is a layout that only looks right on the project it was
 * designed against.
 *
 * Separators below a hundred thousand, because `16,072` is a number you read exactly and
 * `16.1k` is one you read approximately; a unit is a loss of precision and is only worth
 * paying for when the exact digits would not fit anyway. `k` and `M` rather than `K` and
 * `m`: SI, and the same convention `git` and every file manager already use.
 */
export function compactCount(n: number): string {
  if (n < 100_000) return n.toLocaleString()
  if (n < 1_000_000) return `${(n / 1_000).toFixed(0)}k`
  return `${(n / 1_000_000).toFixed(1)}M`
}
