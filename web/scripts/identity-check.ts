/**
 * A node is a new object exactly when it means something new.
 *
 * Every memo under the tree — the sunburst's layout, the percentile tables, the panel, the
 * legend — decides whether to rebuild by asking whether the object it was handed is the one
 * it was handed last time. So identity is not an optimisation here, it is the message: a
 * walk that clones what it did not change is telling the whole window that the whole repo
 * moved, and the window believes it and redraws.
 *
 * That is invisible. The picture that comes out the far end of a needless rebuild is pixel
 * for pixel the picture that went in — it just arrives late, on a period, with the map and
 * the panel flickering through it while a reading pass is running. It has shipped twice:
 * `pruneExcluded` cloning every node it walked, and the readings poll folding all sixteen
 * thousand readings back into the tree every two seconds because they arrived as new objects
 * off the wire. Nothing on screen said so either time.
 *
 * So the rules are pinned here instead. No repo, no window, no framework: one bundle of one
 * file, the same shape `rim-check` and `replay-check` take, and for the same reason. Run it
 * with `just identity-check`.
 */
import {
  NO_READINGS,
  applyAgentReports,
  holdReadings,
  pruneExcluded,
  readInto,
  readIntoRing,
  type AgentReport,
  type Node,
} from '../src/lib/api'

let failed = 0
function check(what: string, ok: boolean, saw?: unknown) {
  if (ok) {
    console.log(`  ok   ${what}`)
    return
  }
  failed += 1
  console.log(`  FAIL ${what}${saw === undefined ? '' : ` — saw ${JSON.stringify(saw)}`}`)
}

/** A proxy score, which is what an unread function's wedge is painted from. */
const score = () =>
  ({
    surprise: 0.5,
    documented: 0.5,
    source: 'proxy',
    analyzedShare: 0,
    provenance: 'human',
    hotShare: 0,
    churn: [0, 0, 0, 0],
    commits: [0, 0, 0, 0],
    ageDays: null,
    lastTouchedDays: null,
    allCommits: null,
    tangle: null,
    cognitive: null,
  }) as unknown as Node['score']

const func = (path: string, name: string, loc: number): Node =>
  ({
    id: `${path}#${name}`,
    name,
    kind: 'func',
    path,
    loc,
    excluded: false,
    funcs: 0,
    children: [],
    body: `${name}-body`,
    score: score(),
  }) as unknown as Node

const file = (path: string, kids: Node[], excluded = false): Node =>
  ({
    id: path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'file',
    path,
    loc: kids.reduce((t, k) => t + k.loc, 0),
    excluded,
    funcs: kids.length,
    // Slim, the way a tree arrives from the backend — its functions come later, per file,
    // and are grafted in by `filled`. `funcs` is what says they exist.
    children: [],
    body: null,
    score: score(),
  }) as unknown as Node

const dir = (path: string, kids: Node[]): Node =>
  ({
    id: path,
    name: path.slice(path.lastIndexOf('/') + 1),
    kind: 'dir',
    path,
    loc: kids.reduce((t, k) => t + k.loc, 0),
    excluded: false,
    funcs: kids.reduce((t, k) => t + k.funcs, 0),
    children: kids,
    score: score(),
  }) as unknown as Node

const reading = (id: string, body: string, predicted: string): AgentReport =>
  ({
    id,
    loc: 20,
    expected: 'a',
    found: 'b',
    surprised: true,
    predicted,
    documented: 'some',
    note: '',
    cold: false,
    body,
    at: '2026-09-09T10:00:00Z',
  }) as unknown as AgentReport

/** The poll's own doing: every reading comes back freshly deserialized, so nothing that
 *  arrives is the object that arrived last time. */
const offTheWire = (list: AgentReport[]): AgentReport[] =>
  JSON.parse(JSON.stringify(list)) as AgentReport[]

const ringA = [func('src/a.rs', 'one', 20), func('src/a.rs', 'two', 30)]
const ringB = [func('src/b.rs', 'three', 40)]
const repo = () =>
  dir('repo', [dir('repo/src', [file('src/a.rs', ringA), file('src/b.rs', ringB)])])

const at = (root: Node, path: string): Node => {
  const hit = (n: Node): Node | null => {
    if (n.path === path) return n
    for (const c of n.children) {
      const found = hit(c)
      if (found) return found
    }
    return null
  }
  const found = hit(root)
  if (!found) throw new Error(`no ${path}`)
  return found
}

console.log('pruning what a .sanityignore set aside')
{
  const root = repo()
  check('a tree with nothing excluded comes back as itself', pruneExcluded(root) === root)

  const excluded = dir('repo', [
    dir('repo/src', [file('src/a.rs', ringA), file('src/b.rs', ringB, true)]),
    dir('repo/docs', [file('docs/x.md', [])]),
  ])
  const pruned = pruneExcluded(excluded)
  check('an exclusion rebuilds the spine above it', pruned !== excluded)
  check(
    'and nothing beside it',
    pruned.children[1] === excluded.children[1],
    pruned.children[1].path,
  )
  check(
    'the size the excluded file took is gone from the directory',
    pruned.children[0].loc === 50,
    pruned.children[0].loc,
  )
  check('and from the repo', pruned.loc === 50, pruned.loc)
  check('running it again changes nothing', pruneExcluded(pruned) === pruned)
}

console.log('a poll that brought the same readings again')
{
  const reports = [reading('src/a.rs#one', 'one-body', 'some')]
  const first = holdReadings(NO_READINGS, reports)
  check('the first poll has something to say', first.moved)

  const again = holdReadings(first.held, offTheWire(reports))
  check('the second does not', !again.moved)
  check('and hands back what the tree is already holding', again.held === first.held)

  const root = repo()
  const folded = applyAgentReports(root, first.held.list)
  check('the reading reached the file that holds it', at(folded, 'src/a.rs') !== at(root, 'src/a.rs'))
  check(
    'folding the same readings into the folded tree is the folded tree',
    applyAgentReports(folded, again.held.list) === folded,
  )
  check('so the map is not asked to redraw', pruneExcluded(folded) === folded)
}

console.log('a poll that brought one new reading')
{
  const reports = [reading('src/a.rs#one', 'one-body', 'some')]
  const held = holdReadings(NO_READINGS, reports).held
  const folded = applyAgentReports(repo(), held.list)

  const landed = offTheWire(reports)
  landed.push(reading('src/b.rs#three', 'three-body', 'none'))
  const next = holdReadings(held, landed)
  check('the poll says something moved', next.moved)
  check(
    'the reading that did not move kept its object',
    next.held.byId.get('src/a.rs#one') === held.byId.get('src/a.rs#one'),
  )

  const after = applyAgentReports(folded, next.held.list)
  check('the file the reading landed in is new', at(after, 'src/b.rs') !== at(folded, 'src/b.rs'))
  check('its directory is new', at(after, 'repo/src') !== at(folded, 'repo/src'))
  check('the root is new', after !== folded)
  check(
    'and the file beside it is the same object',
    at(after, 'src/a.rs') === at(folded, 'src/a.rs'),
  )
  check('and the map is handed a tree it can still share', pruneExcluded(after) === after)
}

console.log('a reading already folded')
{
  const r = reading('src/a.rs#one', 'one-body', 'some')
  const fn = func('src/a.rs', 'one', 20)
  const read = readInto(fn, r)
  check('it paints the wedge once', read !== fn)
  check('and not twice', readInto(read, r) === read)
  check('the grade is the reading, not the proxy', read.score?.source === 'agent')

  const byId = new Map([[r.id, r]])
  const ring = [fn, func('src/a.rs', 'two', 30)]
  const first = readIntoRing(ring, byId)
  check('a ring with a reading in it is rebuilt', first !== ring)
  check('the function without one is untouched', first[1] === ring[1])
  check('and the ring is not rebuilt again', readIntoRing(first, byId) === first)
}

console.log('a reading whose body has moved on')
{
  const fn = func('src/a.rs', 'one', 20)
  const stale = reading('src/a.rs#one', 'a-different-body', 'some')
  const read = readInto(fn, stale)
  check('the wedge falls back to the proxy', read.score?.source === 'proxy')
  check('and says why', read.agentStale === true)
  check('folding it again leaves it there', readInto(read, stale) === read)
}

console.log(failed === 0 ? 'identity-check: ok' : `identity-check: ${failed} FAILED`)
process.exit(failed === 0 ? 0 : 1)
