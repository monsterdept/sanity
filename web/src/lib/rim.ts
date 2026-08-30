/**
 * A directory's distribution, cut into the segments that get drawn.
 *
 * **Lifted out of `Sunburst` so the arithmetic can be checked.** It was a closure inside the
 * component, which meant the one part of the rim that can be wrong in a way nobody sees — the
 * widths, and what a merged run claims to be — was the one part no harness could reach. What
 * is left in the component is geometry: where the band sits, and what a pixel is worth in
 * angle at that radius. See `scripts/rim-check.ts`.
 *
 * Everything here is the sizing rule and nothing here is React.
 */

import { OTHER, OTHER_LABEL, type Slice } from './colorMode'

/** One drawn band of a rim. */
export interface Run {
  fill: string
  label: string
  lines: number
  /** How many slices this run stands for, so a merged one can say so. */
  held: number
  /** Whether `label` names one of them. False for a categorical merge, whose label is
   *  already a count — see below. */
  named: boolean
  a0: number
  a1: number
}

/**
 * **Merged, never dropped, and never drawn under a pixel.** Ordered by the lens's own scale,
 * a run of tiny segments is a run of ADJACENT values — neighbouring bands on a ramp, or the
 * tail of the rank order on a categorical lens. Merging keeps the widths summing to the
 * wedge, where dropping would silently re-proportion the rim.
 *
 * **Only sub-pixel segments merge, and only with each other.** The merge target used to be
 * whatever run came last, wide or not, so a legitimate top-ranked segment absorbed the thin
 * ones behind it: it kept its own name — it was the biggest member — and came out wider than
 * the value it names. kibana's `x-pack` had its lead author on a band several per cent wider
 * than his lines, which is a rim overstating the very thing it exists to show.
 *
 * **A merged run of CATEGORIES is not a value and is not painted as one.** It took the
 * largest member's color and label, on the argument that every color on the rim should be
 * one some wedge in it is wearing. True of the color and false of the label, and the label
 * is the part that makes a claim: on kibana that produced a band captioned with one person's
 * name, drawn in that person's slot color, holding two hundred and nine people and 13% of
 * the directory — the widest segment on the wedge, built entirely out of segments too small
 * to draw. A categorical merge goes to the structural neutral and says how many it holds,
 * which is what `other` means everywhere else in this app.
 *
 * A RAMPED merge keeps the largest member's color, because there the neighbours really are
 * adjacent on one scale and the color between them is on it too — but the card still says
 * how many bands it stands for rather than naming one of them outright.
 *
 * `names` says which of the two this lens is: segments that are NAMES, or points on a scale.
 * `floor` is the narrowest arc worth drawing, in the same angular units as `a0`/`a1`.
 */
export function rimRuns(
  slices: readonly Slice[],
  a0: number,
  a1: number,
  floor: number,
  names: boolean,
): { runs: Run[]; total: number } | null {
  if (slices.length === 0) return null
  const total = slices.reduce((sum, s) => sum + s.lines, 0)
  if (total <= 0) return null
  const span = a1 - a0
  const runs: (Run & { widest: number; merged: boolean })[] = []
  for (const s of slices) {
    const wide = (span * s.lines) / total >= floor
    const last = runs[runs.length - 1]
    // A wide run is a value in its own right and never absorbs anything; only a run that is
    // itself under the floor takes a neighbour.
    if (wide || !last || !last.merged) {
      runs.push({
        fill: s.fill,
        label: s.label,
        lines: s.lines,
        held: 1,
        named: true,
        widest: s.lines,
        merged: !wide,
        a0: 0,
        a1: 0,
      })
      continue
    }
    // The color follows the largest member, so every color on the rim is one some wedge in
    // it is wearing — on a ramp. A categorical merge overwrites both below.
    if (s.lines > last.widest) {
      last.fill = s.fill
      last.label = s.label
      last.widest = s.lines
    }
    last.lines += s.lines
    last.held += 1
  }
  for (const r of runs) {
    if (r.held < 2 || !names) continue
    // The count IS the label. `209 others` beside a neutral swatch is the whole of what this
    // band can honestly claim.
    r.fill = OTHER
    r.label = `${r.held} ${OTHER_LABEL}s`
    r.named = false
  }
  let a = a0
  for (const r of runs) {
    r.a0 = a
    a += (span * r.lines) / total
    r.a1 = a
  }
  return { runs, total }
}
