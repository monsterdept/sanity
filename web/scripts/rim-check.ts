/**
 * What a band on the map is allowed to claim.
 *
 * The rim is a distribution drawn as bands, and the two ways it can lie are both invisible
 * on screen: a band can be WIDER than the value it names, and a band can NAME something it
 * is not. Both shipped, both for months, and neither is visible without knowing the numbers
 * behind the picture — which is what this file has instead of a repo.
 *
 * The case is kibana's `x-pack/platform` in the shape that produced the bug report: two large
 * authors, then a long tail of people each too thin to draw. Before the fix the tail merged
 * into one run captioned with its largest member's name, in that member's color, wider than
 * either real author — and the lead author absorbed his neighbour on the way past.
 *
 * The second half is the same subject one step earlier: what a band SAYS. Age and Churn
 * labelled a function with no git `no git history`, which is a statement about the repo made
 * from a per-function null — and on ceph, 123,000 commits with the log open beside it, that
 * drew as a repo with no git in it.
 *
 * Run it with `just rim-check`. No repo, no window, no framework: one bundle of one file, the
 * same shape `replay-check` takes and for the same reason.
 */
import { rimRuns } from '../src/lib/rim'
import { OTHER, bucketsFor } from '../src/lib/colorMode'
import type { Slice } from '../src/lib/colorMode'
import type { Node } from '../src/lib/api'

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) {
    console.log(`  ok   ${what}`)
    return
  }
  failed += 1
  console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw)}`}`)
}

/** A slice as `histogramsFor` emits one: already sorted, biggest first. */
const at = (label: string, lines: number, fill = `var(--cat-${label.length})`): Slice => ({
  key: label,
  label,
  fill,
  lines,
})

/** The wedge: a full turn, and a floor standing in for one pixel at the radius the rim sits
 *  at. Chosen so a handful of slices clear it and the tail does not, which is the only
 *  property the sizing rule cares about. */
const A0 = 0
const A1 = 2 * Math.PI
/** A fiftieth of the arc. The rim is drawn on ONE directory's wedge, not on the whole
 *  circle, so a pixel is a large fraction of that wedge's angle — which is why a repo's tail
 *  goes sub-pixel long before it goes small. */
const FLOOR = A1 / 50

/** Two real authors and a tail of two hundred, none of whom can be drawn on their own. The
 *  tail is more lines than either author — which is the whole reason the merged band read as
 *  the story rather than as a footnote. */
const TAIL = 209
const kibana: Slice[] = [
  at('Dario Gieselaar', 150_000),
  at('Gerard Soldevila', 120_000),
  // Just under the floor apiece, and a quarter of a million lines between them.
  ...Array.from({ length: TAIL }, (_, i) => at(`tail ${i}`, 1200 - i)),
]
// Sorted the way `sortBuckets` leaves them, so this is the input the drawing pass really gets.
kibana.sort((a, b) => b.lines - a.lines)

console.log('categorical — a merged run is `other`, not a person')
{
  const cut = rimRuns(kibana, A0, A1, FLOOR, true)!
  const total = cut.total
  const merged = cut.runs.filter((r) => r.held > 1)

  check('the tail is one run', merged.length === 1, merged.length)
  const m = merged[0]
  check('it holds the whole tail', m.held === TAIL, m.held)

  // The bug, stated as the thing a reader saw: the widest band on the wedge, wearing one
  // person's name and one person's color.
  check('it names nobody', m.named === false && !m.label.includes('tail'), m.label)
  check('it says how many it holds', m.label === `${TAIL} others`, m.label)
  check('it is the structural neutral', m.fill === OTHER, m.fill)

  // And the second half of the same bug: a wide run must not absorb its thin neighbours.
  const dario = cut.runs.find((r) => r.label === 'Dario Gieselaar')!
  check('a named run holds only itself', dario.held === 1, dario.held)
  check(
    'a named run is exactly as wide as its lines',
    Math.abs((dario.a1 - dario.a0) / (A1 - A0) - dario.lines / total) < 1e-12,
    (dario.a1 - dario.a0) / (A1 - A0),
  )

  // Merging exists so the widths still sum to the wedge. Dropping would re-proportion it.
  const drawn = cut.runs.reduce((sum, r) => sum + (r.a1 - r.a0), 0)
  check('the runs fill the wedge', Math.abs(drawn - (A1 - A0)) < 1e-9, drawn)
  const lines = cut.runs.reduce((sum, r) => sum + r.lines, 0)
  check('every line is in a run', lines === total, [lines, total])
  const held = cut.runs.reduce((sum, r) => sum + r.held, 0)
  check('every slice is in a run', held === kibana.length, [held, kibana.length])
  // Contiguous and in order: a gap or an overlap is a pointer that answers with the wrong
  // segment, which `hoverSlice` has no way to notice.
  check(
    'the runs abut',
    cut.runs.every((r, i) => i === 0 || Math.abs(r.a0 - cut.runs[i - 1].a1) < 1e-12),
  )
}

console.log('ramped — adjacent bands keep a color on the scale')
{
  // A ramp's bands are in scale order, not size order, so a thin band sits between two fat
  // ones. It must not be swallowed by either.
  const ramp: Slice[] = [
    at('today', 500_000, 'var(--age-4)'),
    at('this week', 300, 'var(--age-3)'),
    at('this month', 200, 'var(--age-2)'),
    at('older', 400_000, 'var(--age-0)'),
  ]
  const cut = rimRuns(ramp, A0, A1, FLOOR, false)!
  const merged = cut.runs.filter((r) => r.held > 1)
  check('the two thin bands merge with each other', merged.length === 1, merged.length)
  check('and only with each other', merged[0].held === 2, merged[0].held)
  check('the merge keeps the larger member', merged[0].label === 'this week', merged[0].label)
  check('and a color off the ramp', merged[0].fill === 'var(--age-3)', merged[0].fill)
  check('and still names it', merged[0].named === true)
  check('the wide bands are untouched', cut.runs.filter((r) => r.held === 1).length === 2)
}

console.log('degenerate inputs say nothing rather than guessing')
{
  check('no slices', rimRuns([], A0, A1, FLOOR, true) === null)
  check('no lines', rimRuns([at('nobody', 0)], A0, A1, FLOOR, true) === null)
  const one = rimRuns([at('solo', 5)], A0, A1, FLOOR, true)!
  check('a lone slice is itself', one.runs.length === 1 && one.runs[0].named)
}

console.log('absence — a band says what it knows, not what the repo is')
{
  /** One file holding two functions, neither of which the trace has reached. `funcs: 0` so
   *  the walk reads these function nodes rather than the columns a fetched-ring file has. */
  const func = (loc: number, touched: number | null): Node =>
    ({
      kind: 'func',
      loc,
      children: [],
      excluded: false,
      score: { commits: 0, ageDays: touched === null ? null : 1, lastTouchedDays: touched },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node
  const file = (kids: Node[]): Node =>
    ({ kind: 'file', loc: 0, excluded: false, funcs: 0, children: kids }) as unknown as Node

  for (const mode of ['age', 'churn'] as const) {
    const rows = bucketsFor(dir([file([func(100, null), func(50, null)])]), mode)
    const absent = rows.find((b) => b.lines === 150)!
    // The claim the map is not entitled to make. `locks` in App.tsx is where the repo-level
    // answer lives, because only that surface can tell an untraced repo from a folder with
    // no git — and it says so once, beside the button that fixes it.
    check(
      `${mode}: the band does not call the repo ungitted`,
      !absent.label.includes('no git history'),
      absent.label,
    )
    check(`${mode}: it says what it does know`, absent.label === 'history not read', absent.label)
  }

  // A function the trace HAS reached must still land in a real band, or the fix above would
  // have been to relabel everything.
  const rows = bucketsFor(dir([file([func(100, 0.5)])]), 'age')
  check('a dated function is not an absence', rows[0].label === 'today', rows[0].label)
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nrim: every band is as wide as it says and claims no more than it holds')
