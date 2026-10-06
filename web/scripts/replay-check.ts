/**
 * Two ways to the same frame.
 *
 * `replay` is documented as a pure accelerator: `frameTree(hist, i)` returns the same tree
 * whether or not the memo is warm. Checkpoints make that promise one level deeper — a
 * backward seek thaws a state the fold computed thousands of commits ago and folds the
 * remainder — and a promise that big wants a check that does not depend on anybody having
 * a repo to hand.
 *
 * So: a synthetic timeline, folded to the same commit two ways, compared field by field.
 *
 * - **Forwards** is what playback does: one pass over the whole story, banking checkpoints.
 * - **Backwards** seeks to each commit in descending order, which is the drag this exists
 *   for and the path that thaws.
 * - **Cold** is the ground truth: a structurally identical `Tables` the module has never
 *   seen, so every memo, checkpoint and intern table in it misses and the fold starts from
 *   the opening state.
 *
 * Run it with `just web-check replay`. It prints the seek time it measured, which is the number
 * the whole thing is for.
 */
import { cost, frameTree } from '../src/lib/history'
import type { HistoryFunc } from '../src/lib/history'
import type { Delta, Deltas, Tables } from '../src/lib/timeline'
import type { Node } from '../src/lib/api'

/** `historyFrame.ts`'s own checkpoint spacing, which this file has to know to say what a bounded
 *  remainder is. Duplicated rather than exported: it is a constant of the accelerator, and a
 *  harness that imported its own expectation from the thing it is checking would agree with
 *  whatever that thing was changed to. */
const CHECKPOINT_EVERY = 2_000
const CHECKPOINTS = 12

/** Deterministic, because a harness that finds a bug one run in five has found nothing. */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Fake {
  hist: Tables
  deltas: Deltas
}

/**
 * A timeline shaped like a repo: functions arriving, being rewritten, being deleted, files
 * emptying and refilling, readings landing and being dropped.
 *
 * Every one of those is a field a checkpoint has to carry, and the ones that are easy to
 * lose are the rare ones — a deletion that empties a directory, a reading that is later
 * withdrawn — so the generator makes them on purpose rather than by luck.
 */
function synth(seed: number, files: number, funcs: number, commits: number): Fake {
  const r = rng(seed)
  const paths: string[] = []
  const langs: string[] = []
  const excluded: boolean[] = []
  for (let i = 0; i < files; i++) {
    const a = i % 7
    const b = (i >> 3) % 5
    paths.push(`src/mod${a}/sub${b}/file${i}.ts`)
    langs.push('TypeScript')
    // A tenth of the repo is set aside, the way `.sanityignore` sets it aside: the fold
    // still holds them and the picture must not.
    excluded.push(i % 10 === 9)
  }
  const table: HistoryFunc[] = []
  for (let f = 0; f < funcs; f++) {
    // Every kind, every tier, and a tenth nothing placed — so a fold that dropped the tally
    // on a backward seek would render a different `folded[...]`.
    const kind = f % 10 === 9 ? 255 : ((f % 5) << 2) | (f % 4)
    table.push({ path: f % files, name: `fn${f}`, owner: null, ord: 0, kind })
  }
  const authors = ['ada', 'grace', 'alan', 'edsger', 'barbara']
  const deltas: Delta[] = []
  let ts = 1_500_000_000
  // Live at HEAD of the fold, so deletions name something that exists. An array with a
  // swap-remove rather than a set, because picking a random member of a set is a copy of
  // the set and this generator makes a hundred thousand picks.
  const live: number[] = []
  const slot = new Map<number, number>()
  const born = (f: number) => {
    slot.set(f, live.length)
    live.push(f)
  }
  const died = (f: number) => {
    const i = slot.get(f)
    if (i === undefined) return
    const last = live.pop() as number
    slot.delete(f)
    if (i < live.length) {
      live[i] = last
      slot.set(last, i)
    }
  }
  const any = () => live[Math.floor(r() * live.length)]
  const base: [number, number][] = []
  for (let f = 0; f < Math.floor(funcs / 8); f++) {
    base.push([f, 5 + Math.floor(r() * 200)])
    born(f)
  }
  let next = Math.floor(funcs / 8)
  for (let c = 0; c < commits; c++) {
    // Minutes apart, with the occasional long quiet stretch. **Deliberately closer together
    // than `CHECKPOINT_EVERY`**: the churn window has to reach back PAST a checkpoint, or a
    // seek re-folds every stamp that counts and a checkpoint that forgot the ring would pass
    // this harness. At this rate ninety days is tens of thousands of commits.
    ts += 300 + Math.floor(r() * 600) + (r() < 0.005 ? 86_400 * 40 : 0)
    const set: [number, number][] = []
    const del: number[] = []
    const read: [number, number][] = []
    const unread: number[] = []
    // **The complexity a commit gave a body**, emitted beside `set` as the walk emits it. A
    // sparse array with no withdrawal of its own: the only thing that clears a score is the
    // function leaving, which `del` already does. Deliberately NOT emitted for every `set` —
    // a third of these functions are in an imaginary language nobody taught the parser, so
    // the absence is exercised alongside the presence.
    const cog: [number, number, number][] = []
    const touched = new Set<number>()
    const n = 1 + Math.floor(r() * 12)
    for (let k = 0; k < n; k++) {
      if (r() < 0.35 && next < funcs) {
        const f = next++
        // **A function of zero lines is a function.** It is what says liveness cannot be
        // read off `loc`, which is the whole reason a frame carries `live` beside it.
        set.push([f, r() < 0.02 ? 0 : 3 + Math.floor(r() * 300)])
        // A score of ZERO is a score — most short bodies never fork — so it has to be
        // reachable, and distinguishable from the language that was never counted.
        if (f % 3 !== 0) cog.push([f, r() < 0.3 ? 0 : Math.floor(r() * 60), Math.floor(r() * 300)])
        born(f)
        touched.add(table[f].path)
      } else if (live.length > 0) {
        const pick = any()
        if (r() < 0.12) {
          del.push(pick)
          died(pick)
        } else {
          set.push([pick, 3 + Math.floor(r() * 300)])
          if (pick % 3 !== 0) cog.push([pick, r() < 0.3 ? 0 : Math.floor(r() * 60), Math.floor(r() * 300)])
        }
        touched.add(table[pick].path)
      }
    }
    // Readings land like any other commit to `.sanity/`, and are sometimes withdrawn.
    if (r() < 0.3 && live.length > 0) {
      const pick = any()
      // **Zero is a reading.** Every axis absent packs to zero, so a store that says
      // "unread" with a zero cannot tell that apart from a reading it holds.
      read.push([pick, r() < 0.1 ? 0 : 1 + Math.floor(r() * 0x3ff)])
    }
    if (r() < 0.05 && live.length > 0) unread.push(any())
    deltas.push({
      ts,
      author: authors[Math.floor(r() * authors.length)],
      set,
      del,
      read,
      unread,
      cog,
      files: [...touched],
    })
  }
  const hist: Tables = {
    paths,
    excluded,
    langs,
    funcCount: funcs,
    funcs: table,
    base,
    baseRead: base.slice(0, 20).map(([f]) => [f, 0x12] as [number, number]),
    // Pre-window scores, which `fold` banks and a checkpoint has to carry — the field whose
    // absence draws the oldest and largest part of a repo as a language nobody counted.
    baseCog: base
      .filter(([f]) => f % 3 !== 0)
      .map(([f]) => [f, f % 37, (f * 7) % 250] as [number, number, number]),
    // Enough medians to exercise both arms of `tangleRamp`: the top band is `null`, so a body
    // over 199 lines falls back to the raw count.
    tangleBands: { median: [0, 2, 4, 9, 18, null] },
    baseTs: 1_499_000_000,
    head: 'head',
    truncated: 0,
    commits,
  }
  // Only `at` is ever called on a fold's deltas. A real `Deltas` is a loader and this
  // harness has nothing to load from.
  const store = { at: (i: number) => deltas[i] } as unknown as Deltas
  return { hist, deltas: store }
}

/** The same timeline as a value the module has never seen, so every cache keyed on identity
 *  misses. This is how the harness gets a genuinely cold fold without the module exporting
 *  a reset that only a test would ever call. */
function chill(hist: Tables): Tables {
  return {
    ...hist,
    paths: [...hist.paths],
    excluded: [...hist.excluded],
    langs: [...hist.langs],
    funcs: hist.funcs.map((f) => ({ ...f })),
    base: hist.base.map((b) => [...b] as [number, number]),
  }
}

/** A tree as text, in full: every field a frame writes, in a fixed order, so a difference
 *  is a line rather than a judgement. */
function render(node: Node, out: string[], depth = 0): void {
  const s = node.score
  out.push(
    [
      '  '.repeat(depth),
      node.kind,
      node.id,
      node.name,
      `loc=${node.loc}`,
      `rest=${node.rest ?? '-'}`,
      `lang=${node.lang ?? '-'}`,
      `code=${node.codeKind ? `${node.codeKind.kind}/${node.codeKind.how}` : '-'}`,
      `by=${node.lastAuthor ?? '-'}`,
      `birthBelow=${node.birthBelow ?? '-'}`,
      `touchBelow=${node.touchBelow ?? '-'}`,
      s
        ? `score[surprise=${s.surprise.toFixed(6)} documented=${s.documented.toFixed(6)} churn=${s.churn.map((c) => c.toFixed(6)).join('/')} age=${s.ageDays?.toFixed(6) ?? '-'} touch=${s.lastTouchedDays?.toFixed(6) ?? '-'} commits=${s.commits.join('/')} tangle=${s.tangle?.map((t) => t.toFixed(6)).join('/') ?? '-'} cog=${s.cognitive ?? '-'} hot=${s.hotShare?.toFixed(6) ?? '-'} analyzed=${s.analyzedShare?.toFixed(6) ?? '-'} source=${s.source} appeared=${s.appeared ?? '-'} edited=${s.edited ?? '-'}]`
        : 'score=-',
      node.agent
        ? `agent[${node.agent.predicted ?? '-'}/${node.agent.documented ?? '-'}/${node.agent.legible ?? '-'}/${node.agent.trap ?? '-'}]`
        : 'agent=-',
      // **What a roll-up stands for, because a checkpoint has to carry it too.** The tally is
      // built from `pathTs` and `pathHits`, which a backward seek restores from a checkpoint
      // — and a field left out of `bank` comes back EMPTY rather than missing, which reads as
      // a valid answer: a folded directory with no age at all rather than one that failed to
      // thaw. Rendered here so the three folds have to agree about it like everything else.
      node.folded
        ? `folded[${node.folded.lang.map(([k, v]) => `${k}:${v}`).join(',')}|${node.folded.author
            .map(([k, v]) => `${k}:${v}`)
            .join(',')}|${node.folded.kind.map(([k, v]) => `${k}:${v}`).join(',')}|${node.folded.time.join(',')}|${node.folded.tangle.join(',')}]`
        : 'folded=-',
    ].join(' '),
  )
  for (const c of node.children) render(c, out, depth + 1)
}

function text(node: Node): string {
  const out: string[] = []
  render(node, out)
  return out.join('\n')
}

/** Lines are conserved at every size, and no id is minted twice — the two invariants the
 *  roll-ups can break, and the second one is what the `#/folded` ghost was. */
function invariants(root: Node, where: string, fail: (m: string) => void): void {
  const seen = new Set<string>()
  const walk = (n: Node): number => {
    if (seen.has(n.id)) fail(`${where}: duplicate id ${n.id}`)
    seen.add(n.id)
    if (n.children.length === 0) return n.loc
    const sum = n.children.reduce((s, c) => s + walk(c), 0)
    if (Math.abs(sum - n.loc) > 1e-9) fail(`${where}: ${n.id} holds ${n.loc}, children sum ${sum}`)
    return n.loc
  }
  walk(root)
}

/**
 * A reading of zero is a reading.
 *
 * Every axis absent packs to zero, and `graded` is now a dense `Uint16Array` — so if
 * absence were spelled `0` the store could not tell a reading it holds from one it has
 * never been given, and the map would draw an answered function as unread. The two-ways
 * comparison cannot see this: both paths read the same store and would agree about the
 * same wrong answer. So it is asserted outright, on a timeline small enough that nothing
 * is rolled up.
 */
function zeroIsAReading(fail: (m: string) => void): void {
  const hist: Tables = {
    paths: ['src/a.ts'],
    excluded: [false],
    langs: ['TypeScript'],
    funcCount: 2,
    funcs: [
      { path: 0, name: 'zero', owner: null, ord: 0 },
      { path: 0, name: 'graded', owner: null, ord: 0 },
    ],
    base: [],
    baseTs: 1_500_000_000,
    head: 'head',
    truncated: 0,
    commits: 2,
  }
  const list: Delta[] = [
    {
      ts: 1_500_001_000,
      author: 'ada',
      set: [
        [0, 500],
        [1, 500],
      ],
      del: [],
      files: [0],
    },
    { ts: 1_500_002_000, author: 'ada', set: [], del: [], read: [[0, 0]], files: [] },
  ]
  const deltas = { at: (i: number) => list[i] } as unknown as Deltas
  const root = frameTree(hist, deltas, 1, 'repo', 0)
  const found = new Map<string, Node>()
  const walk = (n: Node) => {
    found.set(n.name, n)
    for (const c of n.children) walk(c)
  }
  walk(root)
  const read = found.get('zero')
  const unread = found.get('graded')
  if (!read || !unread) {
    fail('zero-reading case: the two functions were not drawn')
    return
  }
  if (read.agent === undefined) fail('a packed reading of 0 read as no reading at all')
  if (unread.agent !== undefined) fail('a function nobody has read came back holding a reading')
}

function main(): void {
  let failures = 0
  const fail = (m: string) => {
    failures++
    console.error(`FAIL ${m}`)
  }

  const { hist, deltas } = synth(7, 400, 12_000, 20_000)
  // Every commit the seeks will be checked at.
  //
  // **Clustered just past each checkpoint, because that is where a thawed frame has done the
  // least work of its own.** A seek that folds two thousand commits after thawing repairs
  // most of what a broken checkpoint got wrong; one that folds a handful shows it. The ends
  // and a scatter in between are here for the ordinary cases.
  const marks = [0, 1, 17, 999]
  for (const cp of [2_000, 4_000, 6_000, 8_000, 10_000]) {
    marks.push(cp - 1, cp, cp + 1, cp + 5, cp + 40, cp + 200)
  }
  marks.push(13_337, 19_999)
  const at = marks.filter((i) => i >= 0 && i < hist.commits).sort((a, b) => a - b)

  // Forwards, the way playback goes: a step at a time, banking checkpoints as it passes.
  const forward = new Map<number, string>()
  for (let i = 0; i < hist.commits; i += 37) {
    const tree = frameTree(hist, deltas, i, 'repo', i - 1)
    if (at.includes(i)) forward.set(i, text(tree))
  }
  frameTree(hist, deltas, hist.commits - 1, 'repo', hist.commits - 2)

  // Backwards, which is the drag. Descending, so every one of these thaws.
  let seekMs = 0
  const back = new Map<number, string>()
  for (const i of [...at].reverse()) {
    const t0 = performance.now()
    const tree = frameTree(hist, deltas, i, 'repo', i - 1)
    seekMs = Math.max(seekMs, performance.now() - t0)
    back.set(i, text(tree))
    invariants(tree, `seek ${i}`, fail)
  }

  // Cold, from the opening state, against a timeline nothing has cached.
  let coldMs = 0
  for (const i of at) {
    const fresh = chill(hist)
    const t0 = performance.now()
    const tree = frameTree(fresh, deltas, i, 'repo', i - 1)
    coldMs = Math.max(coldMs, performance.now() - t0)
    const want = text(tree)
    invariants(tree, `cold ${i}`, fail)
    if (back.get(i) !== want) {
      fail(`seek to ${i} differs from a cold fold`)
      const a = (back.get(i) ?? '').split('\n')
      const b = want.split('\n')
      for (let k = 0; k < Math.max(a.length, b.length); k++) {
        if (a[k] !== b[k]) {
          console.error(`  seek: ${a[k] ?? '(missing)'}`)
          console.error(`  cold: ${b[k] ?? '(missing)'}`)
          break
        }
      }
    }
    const fwd = forward.get(i)
    if (fwd !== undefined && fwd !== want) fail(`forward fold to ${i} differs from a cold fold`)
  }

  zeroIsAReading(fail)

  console.log(`checked ${at.length} commits, ${hist.commits} long, ${hist.funcCount} functions`)
  console.log(
    `  worst backward seek ${seekMs.toFixed(1)}ms · worst cold fold ${coldMs.toFixed(1)}ms`,
  )

  // **And the point of all of it, on a timeline long enough for the difference to be the
  // measurement.** A seek that is no faster than a cold fold is a seek that thawed nothing:
  // this fails if the checkpoints are not being reached, which no equality check can notice
  // — a correct answer arrived at slowly looks exactly like a correct answer.
  const long = synth(11, 2_000, 60_000, 120_000)
  for (let i = 0; i < long.hist.commits; i += 500)
    frameTree(long.hist, long.deltas, i, 'repo', i - 1)
  // **Deliberately not a round number.** The forward pass above steps by 500, so a target
  // that is a multiple of it lands exactly on a checkpoint and the seek folds nothing — a
  // best case that would pass this whether or not the remainder is bounded.
  const target = Math.floor(long.hist.commits * 0.55) + 137
  const t1 = performance.now()
  const seek = text(frameTree(long.hist, long.deltas, target, 'repo', target - 1))
  const warm = performance.now() - t1
  const thawed = cost.thawed
  const folded = cost.folded
  const cold0 = chill(long.hist)
  const t2 = performance.now()
  const scratch = text(frameTree(cold0, long.deltas, target, 'repo', target - 1))
  const whole = performance.now() - t2
  console.log(
    `seek to ${target.toLocaleString()} of ${long.hist.commits.toLocaleString()}: ` +
      `${folded.toLocaleString()} commits folded from a checkpoint at ${thawed.toLocaleString()} ` +
      `(${warm.toFixed(0)}ms), against ${cost.folded.toLocaleString()} from the opening state ` +
      `(${whole.toFixed(0)}ms)`,
  )
  if (seek !== scratch) fail(`the long seek to ${target} differs from a cold fold`)
  // **Counted rather than timed.** A seek that thawed nothing returns the right tree slowly,
  // which no comparison of trees can see — so something has to assert it, and a wall clock
  // is the wrong instrument: both numbers are dominated by building the tree, which is the
  // same work either way, and the threshold would need retuning per machine and go flaky on
  // a loaded runner. The claim being made is that a seek folds a bounded remainder rather
  // than the whole story, and that is a count. The times are printed, not asserted on.
  if (thawed < 0) fail(`the seek to ${target} thawed nothing and folded from the opening state`)
  // **The bound is the SPACING a bounded bank can actually promise, not the spacing it takes
  // them at.** A dozen checkpoints over a long history sit `commits / CHECKPOINTS` apart
  // however often one is banked — `CHECKPOINT_EVERY` is the floor, and it binds only while
  // the story is short enough for the whole ladder to fit. Asserting the floor here would be
  // asserting something this design does not claim.
  const bound = Math.max(CHECKPOINT_EVERY, Math.ceil(long.hist.commits / CHECKPOINTS)) * 1.5
  if (folded > bound)
    fail(`the seek to ${target} folded ${folded} commits, over a bound of ${Math.round(bound)}`)
  if (failures > 0) {
    console.error(`${failures} failure(s)`)
    process.exit(1)
  }
  console.log('ok')
}

main()
