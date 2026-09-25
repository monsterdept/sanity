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
 * Run it with `just web-check rim`. No repo, no window, no framework: one bundle of one file, the
 * same shape `replay-check` takes and for the same reason.
 */
import { rimRuns } from '../src/lib/rim'
import { OTHER, VIEWS_DEFAULT, bucketsFor, histogramsFor, sortBuckets } from '../src/lib/colorMode'
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
      score: {
        commits: [0, 0, 0, 0],
        churn: [0, 0, 0, 0],
        ageDays: touched === null ? null : 1,
        lastTouchedDays: touched,
      },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node
  const file = (kids: Node[]): Node =>
    ({ kind: 'file', loc: 0, excluded: false, funcs: 0, children: kids }) as unknown as Node

  /** A repo whose timeline HAS been walked, so Churn's own absence is not in the way. */
  const walked = {
    age: { span: 900, read: 'newest' as const },
    churn: { windows: [30, 60, 90, 180] as [number, number, number, number], at: 2, measured: true },
    tangle: 'weighted' as const,
    blame: 'touched' as const,
    derivable: 'none' as const,
  }
  for (const mode of ['age', 'churn'] as const) {
    const rows = bucketsFor(dir([file([func(100, null), func(50, null)])]), mode, undefined, walked)
    const absent = rows.find((b) => b.lines === 150)!
    // The claim the map is not entitled to make. `useLocks` in hooks/useLens.ts is where the repo-level
    // answer lives, because only that surface can tell an untraced repo from a folder with
    // no git — and it says so once, beside the button that fixes it.
    check(
      `${mode}: the band does not call the repo ungitted`,
      !absent.label.includes('no git history'),
      absent.label,
    )
    check(`${mode}: it says what it does know`, absent.label === 'history not read', absent.label)
  }

  // **And Churn has a second absence, which must not be spelled like the first.** "History not
  // read" is a fact about a FOLDER — git knows nothing about these lines. An unwalked timeline
  // is a fact about the TRACE: the repo has history and nobody has counted how often each
  // function changed. Drawing them alike would tell somebody their repo has no git when what it
  // has is unfinished work, which is the mirror of the `no git history` claim above.
  {
    const rows = bucketsFor(dir([file([func(100, 0.5)])]), 'churn')
    check(
      'churn: an unwalked timeline is its own absence',
      rows[0].label === 'timeline not walked',
      rows[0].label,
    )
  }

  // A function the trace HAS reached must still land in a real band, or the fix above would
  // have been to relabel everything.
  const rows = bucketsFor(dir([file([func(100, 0.5)])]), 'age')
  check('a dated function is not an absence', rows[0].label === 'today', rows[0].label)
}

console.log('roll-ups — a count is not a member of a distribution')
{
  /** What a REPLAY frame folds a file's undrawable functions into: their combined lines,
   *  a count, and by design no reading at all. See `history.ts`'s `standIn`. */
  const standIn = (loc: number, count: number): Node =>
    ({ kind: 'func', loc, rest: count, children: [], excluded: false, score: null }) as unknown as Node
  const dated = (loc: number): Node =>
    ({
      kind: 'func',
      loc,
      children: [],
      excluded: false,
      score: { commits: 3, ageDays: 400, lastTouchedDays: 0.5 },
    }) as unknown as Node
  const file = (kids: Node[]): Node =>
    ({ kind: 'file', loc: 0, excluded: false, funcs: 0, children: kids }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node

  // The shape of ceph's last frame: a little drawn code, and a great deal folded away.
  const rows = bucketsFor(dir([file([dated(100), standIn(890_200, 4_000)])]), 'age')
  const absent = rows.find((b) => b.label === 'history not read')
  check('a roll-up is not an absence', absent === undefined, absent?.lines)
  check('and its lines are not counted anywhere', rows.reduce((n, b) => n + b.lines, 0) === 100)
  check('the drawn function still is', rows[0]?.label === 'today', rows[0]?.label)

  // Under Blame too: the per-directory `crowd` stand-in is a file with no author, and it
  // was landing in `not in git` with every line it stands for.
  const blame = bucketsFor(
    dir([
      ({ kind: 'file', loc: 500, excluded: false, funcs: 3, rest: 12, children: [], lastAuthor: null }) as unknown as Node,
    ]),
    'blame',
  )
  check('a crowd of files is not `not in git`', blame.length === 0, blame.map((b) => b.label))
}

console.log("roll-ups — and a count that knows what it holds says so")
{
  /** ceph's `src/pybind` as a replay folds it: a sliver drawn, the rest rolled into one
   *  stand-in — 1,152 files down to 183. Measured live, the directory is 71% Python and 29%
   *  TypeScript; drawn from what survives the fold alone it is 100% TypeScript. */
  const drawn = (loc: number, lang: string): Node =>
    ({ kind: 'file', loc, lang, excluded: false, funcs: 1, children: [] }) as unknown as Node
  const crowd = (
    loc: number,
    count: number,
    lang: [string, number][],
    /** `TimeRow` per folded file — see `Folded.time`. */
    time: number[] = [],
  ): Node =>
    ({
      kind: 'file',
      loc,
      excluded: false,
      funcs: 0,
      rest: count,
      lang: null,
      lastAuthor: null,
      children: [],
      folded: { lang, author: [], time },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node

  const pybind = dir([
    drawn(517, 'TypeScript'),
    crowd(194_999, 969, [
      ['Python', 138_006],
      ['TypeScript', 56_365],
      ['Shell', 508],
      ['JavaScript', 120],
    ]),
  ])
  // The app always hands these in — an unranked category is `other`, so a fixture without
  // them would be testing the fallback rather than the fold.
  const ranks = new Map([
    ['Python', 0],
    ['TypeScript', 1],
    ['Shell', 2],
    ['JavaScript', 3],
  ])
  const rows = bucketsFor(pybind, 'language', ranks)
  const total = rows.reduce((n, b) => n + b.lines, 0)
  const share = (k: string) => (rows.find((b) => b.label === k)?.lines ?? 0) / total

  check('the fold does not shrink the population', total === 195_516, total)
  check('Python leads, as it does live', rows[0]?.label === 'Python', rows[0]?.label)
  check('at 71%', Math.round(share('Python') * 100) === 71, share('Python'))
  check('TypeScript at 29%', Math.round(share('TypeScript') * 100) === 29, share('TypeScript'))
  check('and the small two survive', rows.length === 4, rows.map((b) => b.label))

  // The lines are counted, never listed: a tally has no node to point at.
  const crowded = rows.find((b) => b.label === 'Python')!
  check('a tallied bucket lists nothing it cannot show', crowded.nodes.length === 0)

  // A lens the tally cannot answer keeps saying nothing rather than inventing a band. Age is
  // a fact about a FUNCTION and the frame carries no per-file dates, so the roll-up's lines
  // stay out of the distribution entirely — where a wrong band would be a reading nobody took.
  const dated = ({
    kind: 'func',
    loc: 517,
    children: [],
    excluded: false,
    score: { commits: 1, ageDays: 400, lastTouchedDays: 0.5 },
  }) as unknown as Node
  const aged = bucketsFor(
    dir([
      ({ kind: 'file', loc: 517, excluded: false, funcs: 0, children: [dated] }) as unknown as Node,
      crowd(194_999, 969, [['Python', 138_006]]),
    ]),
    'age',
    ranks,
  )
  check(
    'a fold with no time tally still says nothing',
    aged.reduce((n, b) => n + b.lines, 0) === 517,
    aged.map((b) => [b.label, b.lines]),
  )
  check('and does not invent a band for it', aged.length === 1 && aged[0].label === 'today')
}

console.log('a row this lens has no band for sorts LAST, not first')
{
  // **`indexOf` returns −1, which is smaller than every real position.** So a key a lens has
  // no band for used to lead the panel — and that is not a hypothetical: it is exactly how the
  // labels-vs-order mismatch showed up when Complexity was sorting by Age's band list. Every
  // row tied at −1, the sort did nothing, and the breakdown came out in arrival order with the
  // odd one on top. Nothing was empty and nothing threw.
  const rows = [
    { key: 'low', lines: 10 },
    { key: 'not a band this lens has', lines: 10 },
    { key: 'very high', lines: 10 },
  ]
  const out = sortBuckets([...rows], 'tangle')
  check(
    'the loud band still leads',
    out[0].key === 'very high',
    out.map((r) => r.key),
  )
  check(
    'and the stranger goes to the back',
    out[out.length - 1].key === 'not a band this lens has',
    out.map((r) => r.key),
  )
}

console.log('a container draws its distribution, not its mean')
{
  // **The bug: `src-tauri` drew as ONE shade while the pane beside it showed four.** A file
  // stands in for its own functions when its ring has not been fetched — otherwise a rim is
  // built from whichever files happened to load, which is a biased sample drawn confidently.
  // Which lenses may do that was a chain of `||`, and the twelfth was not in it, so every
  // container on the map fell back to the flat roll-up. Nothing threw. It just averaged.
  const withCols = (loc: number, tangles: [number, number][]): Node =>
    ({
      kind: 'file',
      loc,
      excluded: false,
      funcs: tangles.length,
      children: [],
      score: {
        commits: [0, 0, 0, 0],
        churn: [0, 0, 0, 0],
        ageDays: 1,
        lastTouchedDays: 1,
        tangle: [
          tangles.reduce((n, t) => n + t[0], 0) / tangles.length,
          tangles.reduce((n, t) => n + t[1], 0) / tangles.length,
        ],
        cognitive: 4,
      },
      cols: {
        loc: tangles.map(() => loc / tangles.length),
        commits: tangles.map(() => [0, 0, 0, 0]),
        touched: tangles.map(() => 1),
        callers: tangles.map(() => -1),
        calls: tangles.map(() => -1),
        clones: tangles.map(() => -1),
        // Thousandths, the wire's own units — see `Cols::tangle`. Without these a ring-less
        // file has nothing to say about complexity, which is the state this whole case is
        // about: the rim used to draw anyway and quietly leave the file's lines out.
        tangle: tangles.map((t) => [Math.round(t[0] * 1000), Math.round(t[1] * 1000)]),
      },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', id: 'd', loc: 400, excluded: false, children: kids }) as unknown as Node

  // Four files, each landing in a different band. A container over them must draw four
  // segments, not one average.
  const root = dir([
    withCols(100, [[0.9, 0.9]]),
    withCols(100, [[0.5, 0.5]]),
    withCols(100, [[0.2, 0.2]]),
    withCols(100, [[0, 0]]),
  ])
  const hist = histogramsFor(root, 'tangle', undefined, {
    age: { span: 900, read: 'newest' as const },
    churn: { windows: [30, 60, 90, 180] as [number, number, number, number], at: 2, measured: true },
    tangle: 'weighted' as const,
    blame: 'touched' as const,
    derivable: 'none' as const,
  })
  const slices = hist.get('d') ?? []
  check(
    'a directory rim carries every band under it',
    slices.length === 4,
    slices.map((x) => x.label),
  )
  check(
    'and they are not all one colour',
    new Set(slices.map((x) => x.fill)).size === 4,
    slices.map((x) => x.fill),
  )
}

console.log('every banded lens sorts by its OWN bands and paints from its OWN ramp')
{
  // **The bug this is written against drew a gold map beside a green legend.** Two ternaries,
  // `mode === 'churn' ? … : 'age'`, written when there were two banded lenses — a third fell
  // straight through both, so Complexity took Age's ramp for its swatches and Age's band list
  // for its order. `indexOf` returned −1 for every row, so the sort did nothing and the rows
  // came out in arrival order. Nothing threw and the picture looked like a picture.
  const fn = (loc: number, tangle: [number, number]): Node =>
    ({
      kind: 'func',
      loc,
      children: [],
      excluded: false,
      score: {
        commits: [0, 0, 0, 0],
        churn: [0, 0, 0, 0],
        ageDays: 1,
        lastTouchedDays: 1,
        tangle,
        cognitive: Math.round(tangle[1] * 15),
      },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node
  const file = (kids: Node[]): Node =>
    ({ kind: 'file', loc: 0, excluded: false, funcs: 0, children: kids }) as unknown as Node

  const rows = bucketsFor(
    dir([file([fn(10, [0.9, 0.9]), fn(10, [0.5, 0.5]), fn(10, [0.1, 0.1]), fn(10, [0, 0])])]),
    'tangle',
  )
  // Worst first, the direction every breakdown here reads in.
  check(
    'complexity bands run worst first',
    rows.map((r) => r.label).join(' · ') ===
      'very high · high · moderate · low',
    rows.map((r) => r.label),
  )
  // The swatch has to be a colour that is actually on the map. Its own ramp, not the one the
  // ternary next door happened to reach for.
  check(
    'and every swatch comes from the complexity ramp',
    rows.every((r) => r.fill.includes('--tangle')),
    rows.map((r) => [r.label, r.fill]),
  )
}

console.log('columns — a file whose ring never arrived still bands, and does not throw')
{
  // **The path that crashed.** A file too small to have had its functions fetched carries
  // `cols` instead of children, and `contributeCols` rebuilds a stand-in from them. Its inline
  // score was missing `churn` — a field `Score` had grown and a cast through `unknown` hid —
  // so the first Churn render over such a file threw `undefined is not an object`. Nothing in
  // `tsc` could see it and nothing here exercised it.
  //
  // On a large repo most files are in this state, so this is not an edge: it is the common
  // case for the lens that had just been rewritten.
  const withCols = (loc: number, commits: [number, number, number, number][]): Node =>
    ({
      kind: 'file',
      loc,
      excluded: false,
      funcs: commits.length,
      children: [],
      cols: {
        loc: commits.map(() => loc / commits.length),
        commits,
        touched: commits.map(() => 3),
        callers: commits.map(() => -1),
        calls: commits.map(() => -1),
        clones: commits.map(() => -1),
      },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node
  const ladder = { windows: [30, 60, 90, 180] as [number, number, number, number], measured: true }
  const file = withCols(200, [
    [1, 2, 3, 4],
    [8, 16, 24, 40],
  ])

  for (const at of [0, 1, 2, 3]) {
    const views = {
      age: { span: 900, read: 'newest' as const },
      churn: { ...ladder, at },
      tangle: 'weighted' as const,
    blame: 'touched' as const,
    derivable: 'none' as const,
    }
    const rows = bucketsFor(dir([file]), 'churn', undefined, views)
    check(
      `columns band at rung ${at}`,
      rows.reduce((n, b) => n + b.lines, 0) === 200,
      rows.map((b) => [b.label, b.lines]),
    )
    // Every band a column produces has to carry a colour, or the rim draws a segment the
    // ramp never filled — the same check the fold gets below.
    check(
      `and every rung's bands are coloured`,
      rows.every((b) => b.fill !== ''),
      rows.map((b) => [b.label, b.fill]),
    )
  }

  // The rung is the rung: the busy function is `10+` at the widest window and lower at the
  // narrowest, which is the whole reason the columns carry four counts rather than one.
  const bandAt = (at: number) => {
    const views = {
      age: { span: 900, read: 'newest' as const },
      churn: { ...ladder, at },
      tangle: 'weighted' as const,
    blame: 'touched' as const,
    derivable: 'none' as const,
    }
    const rows = bucketsFor(dir([file]), 'churn', undefined, views)
    return rows.find((b) => b.lines === 100)?.label
  }
  check('a narrow window bands the busy function lower', bandAt(0) === '3–9 commits', bandAt(0))
  check('and a wide one bands it higher', bandAt(3) === '10+ commits', bandAt(3))
}

console.log('roll-ups — and the time tally puts a folded file in its own band')
{
  const crowd = (loc: number, count: number, time: number[]): Node =>
    ({
      kind: 'file',
      loc,
      excluded: false,
      funcs: 0,
      rest: count,
      lang: null,
      lastAuthor: null,
      children: [],
      folded: { lang: [], author: [], time },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node

  // Four folded files, as `[touched, born, lines, c30, c60, c90, c180]` — see `TimeRow`. One
  // touched today out of code from long ago, one touched this quarter that the replayed
  // window never saw ARRIVE (every file in the opening state is this), one long ago on both
  // readings, and one the window never saw touched at all.
  //
  // The commit counts rise with the window, as a real file's do: what is being pinned below is
  // that the rung the caller asks for is the rung that gets banded.
  const folded = crowd(1_000, 4, [
    0.5, 900, 100, 3, 6, 9, 18,
    45, -1, 200, 0, 1, 2, 4,
    900, 900, 300, 0, 0, 0, 0,
    -1, -1, 400, 0, 0, 0, 0,
  ])
  /** The repo's ladder, and a walk that has run — without `measured` the lens paints nothing. */
  const ladder = { windows: [30, 60, 90, 180] as const, at: 2, measured: true }
  const views = (read: 'newest' | 'oldest') => ({
    age: { span: 900, read },
    churn: { ...ladder, windows: [...ladder.windows] as [number, number, number, number] },
    tangle: 'weighted' as const,
    blame: 'touched' as const,
    derivable: 'none' as const,
  })

  const aged = bucketsFor(dir([folded]), 'age', undefined, views('newest'))
  const at = (label: string) => aged.find((b) => b.label === label)?.lines ?? 0
  check('every folded line is placed', aged.reduce((n, b) => n + b.lines, 0) === 1_000)
  check('today', at('today') === 100, at('today'))
  check('this quarter', at('this quarter') === 200, at('this quarter'))
  check('older', at('older') === 300, at('older'))
  // The window's own rule: nothing before it makes a claim about its age. Undated, not banded.
  check('and the undated one is an absence', at('history not read') === 400, at('history not read'))
  // Absence sorts last however the rest is ordered — see `sortBuckets`.
  check('which sorts last', aged[aged.length - 1].label === 'history not read')

  // **The same fold, read by the other date.** The point of the fifth number: a file touched
  // today out of code from 2014 is `today` under one reading and `older` under the other, and
  // before the fold carried a birth date the roll-up had only one number and wrote it into
  // both fields — so this row would have been banded `today` on both.
  const oldest = bucketsFor(dir([folded]), 'age', undefined, views('oldest'))
  const wasOldest = (label: string) => oldest.find((b) => b.label === label)?.lines ?? 0
  check('every folded line is placed under the other reading',
    oldest.reduce((n, b) => n + b.lines, 0) === 1_000)
  check('oldest line long ago', wasOldest('older') === 400, wasOldest('older'))
  // Touched this quarter and never seen to arrive: the window's rule says nothing about when
  // it was written, so it is an absence HERE and a band under `touched`. One file, two
  // honest answers, which is the whole reason the two dates are separate fields.
  check('and a file the window never saw arrive is an absence',
    wasOldest('history not read') === 600, wasOldest('history not read'))

  // Churn reads the same tally through the same branch, so the two cannot disagree about
  // which file is busy.
  //
  // **And it is gated on the TOUCH date, which is what keeps that file banded.** The gate was
  // `ageDays` while `ageDays` was only ever a copy of the touch date; now that the fold
  // reports a real birth, an opening-state file has a null birth and a real touch, and a
  // churn gate still reading `ageDays` would drop it — 200 lines here, and most of every
  // frame on a repo whose story starts partway in.
  const churn = bucketsFor(dir([folded]), 'churn', undefined, views('newest'))
  const busy = churn.find((b) => b.label === '3–9 commits')
  check('churn bands the same fold', busy?.lines === 100, churn.map((b) => [b.label, b.lines]))
  // An empty fill is a ramped bucket whose mean never arrived — see `bucketsFor`. It is what
  // a folded file would draw if the tally carried a band but no ramp value, which is why the
  // churn number rides in the tally rather than being derived where it is read.
  check(
    'and a band it can colour',
    !!busy && busy.fill !== '' && busy.fill.includes('--churn'),
    busy?.fill,
  )
  // **The row that pins the gate.** Touched this quarter, never seen to ARRIVE — an
  // opening-state file. Its birth is null and its touch is real, so a churn gate reading the
  // birth drops it into `history not read` and reports a busy file as an unwalked one. This
  // is the check that fails if the gate moves back to `ageDays`.
  const early = churn.find((b) => b.label === '1–2 commits')
  check('and an opening-state file is still banded by its commits',
    early?.lines === 200, churn.map((b) => [b.label, b.lines]))
}

console.log('docs — the derivable switch decides what a useless comment is painted as')
{
  // A function whose doc a reader graded `some` and then judged derivable. The rim bands it
  // as `none` or as `full`, never at `some`: the two readings differ only by the switch, so a
  // surface that stops consulting it draws the same row twice and fails here.
  const doc = (derivable: boolean): Node =>
    ({
      kind: 'func',
      loc: 100,
      children: [],
      excluded: false,
      agent: { derivable, documented: 'some' },
      agentStale: false,
      score: { commits: [0, 0, 0, 0], churn: [0, 0, 0, 0], ageDays: 1, lastTouchedDays: 1 },
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', loc: 0, excluded: false, children: kids }) as unknown as Node
  const file = (kids: Node[]): Node =>
    ({ kind: 'file', loc: 0, excluded: false, funcs: 0, children: kids }) as unknown as Node
  const lines = (derivable: boolean, derived: 'none' | 'full', grade: string) =>
    bucketsFor(dir([file([doc(derivable)])]), 'docs', undefined, {
      ...VIEWS_DEFAULT,
      derivable: derived,
    }).find((b) => b.key === grade)?.lines
  check('`none` bands a derivable doc as none', lines(true, 'none', 'none') === 100)
  check('`full` bands it as full', lines(true, 'full', 'full') === 100)
  check('and a doc nobody judged derivable keeps its grade', lines(false, 'full', 'some') === 100)
}

console.log('held readings — a ring-less file nobody has read still counts its lines')
{
  // **`contributeHeld` returned before its remainder when a file held no readings.** A file whose
  // functions were never fetched and that nobody had read put its lines in no band at all — while
  // `histogramsFor` still called its directory whole, on the stated ground that held readings and
  // the remainder "together cover every line". It surfaced as a report whose Surprise breakdown
  // counted fewer lines than its map.
  const unfetched = (loc: number, pending?: unknown[]): Node =>
    ({
      kind: 'file',
      id: `f${loc}`,
      path: `f${loc}.rs`,
      loc,
      excluded: false,
      funcs: 3,
      children: [],
      pending,
    }) as unknown as Node
  const dir = (kids: Node[]): Node =>
    ({ kind: 'dir', id: 'd', path: 'd', loc: 0, excluded: false, children: kids }) as unknown as Node
  const read = { id: 'f100.rs#a', predicted: 'full', loc: 40, stale: false }
  const tree = () => dir([unfetched(120), unfetched(100, [read])])
  const total = (mode: 'surprise' | 'legible' | 'traps' | 'docs') =>
    bucketsFor(tree(), mode, undefined, VIEWS_DEFAULT).reduce((t, b) => t + b.lines, 0)
  for (const mode of ['surprise', 'legible', 'traps'] as const) {
    check(`${mode}: every line of a ring-less file is in a band, read or not`, total(mode) === 220, total(mode))
  }
  // Docs counts a file's header as a reading beside its functions, so its lines come twice by
  // design — the pane counts readings, not lines. What must not happen is the unread half vanishing.
  check('docs: the header and every function line, read or not', total('docs') === 440, total('docs'))
  const rim = histogramsFor(dir([unfetched(120)]), 'surprise', undefined, VIEWS_DEFAULT).get('d') ?? []
  check(
    'and a directory of unread ring-less files has a rim that holds their lines',
    rim.reduce((t, s) => t + s.lines, 0) === 120,
    rim.map((s) => [s.label, s.lines]),
  )
}

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`)
  process.exit(1)
}
console.log('\nrim: every band is as wide as it says and claims no more than it holds')
