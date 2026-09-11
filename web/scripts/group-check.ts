/**
 * How a report groups its findings, and where each group's map zooms to.
 *
 * `groupFindings` decides what a reader sees together on one zoomed map. Its failures are all
 * quiet: a finding dropped from every group is a finding the report never mentions, a group
 * over the cap is the crowded map grouping exists to prevent, and a root one level too high is
 * a map zoomed out for no reason. None of those look broken on a page.
 *
 * Run it with `just group-check`. Bundled and run like the other checks.
 */
import { groupFindings, type Placed } from '../src/lib/findings'

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) {
    console.log(`  ok   ${what}`)
    return
  }
  failed += 1
  console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw)}`}`)
}

const fn = (path: string): Placed => ({ path, kind: 'func' })
const file = (path: string): Placed => ({ path, kind: 'file' })
const run = (items: Placed[], max?: number, min?: number) => groupFindings(items, (p) => p, max, min)
const roots = (items: Placed[], max?: number, min?: number) =>
  run(items, max, min).map((g) => `${g.kind}:${g.root}:${g.items.length}`)

console.log('a group that fits')
{
  const got = roots([fn('a/b/x.rs'), fn('a/b/y.rs'), file('a/c/z.rs')])
  check('zooms to the deepest directory holding all of them', got.join() === 'dir:a:3', got)
}
{
  const got = roots([fn('a/x.rs'), fn('a/x.rs')])
  check('functions in one file zoom to the file', got.join() === 'file:a/x.rs:2', got)
}
{
  const got = roots([fn('a/x.rs'), file('a/x.rs')])
  check("a file finding keeps the file's directory, where its wedge is", got.join() === 'dir:a:2', got)
}
{
  const got = roots([file('x.rs'), fn('y.rs')])
  check('top-level files zoom to the repo', got.join() === 'dir::2', got)
}

console.log('a group that does not')
{
  const items = [
    ...Array.from({ length: 6 }, (_, i) => fn(`src/lib/f${i}.ts`)),
    ...Array.from({ length: 5 }, (_, i) => fn(`src/components/c${i}.tsx`)),
    fn('scripts/s.py'),
  ]
  const got = roots(items)
  check(
    'splits down to the directories, and a lone stray keeps its own tight zoom',
    got.join() === 'dir:src/lib:6,dir:src/components:5,file:scripts/s.py:1',
    got,
  )
}
{
  const items = [
    ...Array.from({ length: 8 }, (_, i) => fn(`big/f${i}.rs`)),
    fn('p/a.rs'),
    fn('q/b.rs'),
  ]
  const got = roots(items)
  check('small parts are pooled at the level they were found', got.join() === 'dir:big:8,dir::2', got)
}
{
  const got = roots(Array.from({ length: 20 }, () => fn('src/App.tsx')))
  check('one file past the cap stays one group, zoomed to the file', got.join() === 'file:src/App.tsx:20', got)
}
{
  // styx: `internal` held one real group and thirteen strays across its subdirectories, and the
  // strays came out as `internal (8)` and `internal (5)` — the same map twice.
  const items = [
    ...Array.from({ length: 4 }, (_, i) => fn(`internal/devbox/d${i}.go`)),
    ...['a', 'b', 'c', 'd', 'e', 'f'].flatMap((d) => [fn(`internal/${d}/x.go`), fn(`internal/${d}/y.go`)]),
    fn('internal/g/z.go'),
  ]
  const got = roots(items)
  check('strays past the cap stay one group rather than two of the same place', got.join() === 'dir:internal/devbox:4,dir:internal:13', got)
}

console.log('order')
{
  // Widest first in, so the group holding the first item must come first out.
  const items = [fn('z/one.rs'), ...Array.from({ length: 9 }, (_, i) => fn(`a/f${i}.rs`)), fn('z/two.rs'), fn('z/three.rs')]
  const groups = run(items)
  check('a group goes where its widest finding would have', groups[0].items[0] === items[0], roots(items))
  check('inside a group the order is kept', groups.every((g) => g.items.every((t, i) => i === 0 || items.indexOf(g.items[i - 1]) < items.indexOf(t))))
}

console.log('a large repo')
{
  // Deterministic scatter across a nested tree, so a failure reproduces.
  let seed = 7
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648
  const dirs = ['src', 'src/osd', 'src/osd/scrub', 'src/mon', 'src/rgw', 'src/rgw/driver', 'qa', 'qa/tasks', 'doc', '']
  const items = Array.from({ length: 400 }, () => {
    const d = dirs[Math.floor(next() * dirs.length)]
    const name = `${d ? `${d}/` : ''}f${Math.floor(next() * 12)}.cc`
    return next() < 0.3 ? file(name) : fn(name)
  })
  // `file` findings are unique per path in real data; the duplicates here only stress the split.
  const groups = run(items)
  const seen = groups.flatMap((g) => g.items)
  check('every finding is in exactly one group', seen.length === items.length && new Set(seen).size === items.length, [seen.length, items.length])
  const places = groups.map((g) => `${g.kind}:${g.root}`)
  check('no two groups share a place', new Set(places).size === places.length, places)
  check(
    'a group past the cap could not have been split: no subdirectory under it holds 3 of its findings',
    groups
      .filter((g) => g.kind === 'dir' && g.items.length > 8)
      .every((g) => {
        const under = new Map<string, number>()
        for (const t of g.items) {
          const rel = g.root ? t.path.slice(g.root.length + 1) : t.path
          const cut = rel.indexOf('/')
          if (cut >= 0) under.set(rel.slice(0, cut), (under.get(rel.slice(0, cut)) ?? 0) + 1)
        }
        return [...under.values()].every((n) => n < 3)
      }),
  )
  check(
    "every group's root holds all of its findings",
    groups.every((g) =>
      g.items.every((t) => (g.kind === 'file' ? t.path === g.root : g.root === '' || t.path.startsWith(`${g.root}/`))),
    ),
  )
  check('a file-rooted group holds only functions', groups.filter((g) => g.kind === 'file').every((g) => g.items.every((t) => t.kind === 'func')))
}

if (failed > 0) {
  console.log(`\n${failed} failed`)
  process.exit(1)
}
console.log('\nall passed')
