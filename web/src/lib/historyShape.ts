import type { Tables } from './timeline'

/**
 * The replay's paths, interned once per timeline: the directory tree they make, the paths
 * under one drilled scope, and the lookup from a path back to its index.
 *
 * Every answer here is a property of the path table rather than of any frame, which is why each
 * is memoised against the timeline it was built from and rebuilt only when that changes.
 */

/**
 * The directory tree of a timeline, interned once.
 *
 * **A replay's paths never change**, so the shape they make is a property of the timeline
 * and not of the frame — which is what lets a frame ask "what is under this directory"
 * without walking anything. Dirs are indices here for the same reason paths already are:
 * a frame totals lines into a dense array, and a string key would put a hash in the middle
 * of the hottest loop in the module.
 *
 * `ancestors` is innermost-first and excludes the root. It is what `advance` walks when a
 * function arrives or leaves: the string version allocated an array of paths per arrival and
 * hashed each one into a map, which is a per-commit cost for an answer that never changes.
 */
export interface Shape {
  hist: Tables
  /** Dir path per index. `0` is the repo root, whose path is the empty string. */
  path: string[]
  name: string[]
  /** Child directories, and the files that sit directly inside — path indices. */
  kids: number[][]
  files: number[][]
  /** Each file path's own directory, and its whole ancestor chain. */
  owner: Int32Array
  ancestors: Int32Array[]
  /** Directory path → index, which is how a container looks its own arrival up by node id.
   *  Built here because it is built here anyway — `dirFor` needs it to intern. */
  dirAt: Map<string, number>
}

let shaped: Shape | null = null
export function shapeOf(hist: Tables): Shape {
  if (shaped && shaped.hist === hist && shaped.owner.length === hist.paths.length) return shaped
  const at = new Map<string, number>([['', 0]])
  const shape: Shape = {
    hist,
    path: [''],
    name: [hist.paths.length > 0 ? '' : ''],
    kids: [[]],
    files: [[]],
    owner: new Int32Array(hist.paths.length),
    ancestors: new Array<Int32Array>(hist.paths.length),
    dirAt: at,
  }
  const dirFor = (path: string): number => {
    const had = at.get(path)
    if (had !== undefined) return had
    const cut = path.lastIndexOf('/')
    const parent = dirFor(cut === -1 ? '' : path.slice(0, cut))
    const idx = shape.path.length
    shape.path.push(path)
    shape.name.push(cut === -1 ? path : path.slice(cut + 1))
    shape.kids.push([])
    shape.files.push([])
    at.set(path, idx)
    shape.kids[parent].push(idx)
    return idx
  }
  hist.paths.forEach((p, i) => {
    const cut = p.lastIndexOf('/')
    const dir = dirFor(cut === -1 ? '' : p.slice(0, cut))
    shape.owner[i] = dir
    shape.files[dir].push(i)
    const chain: number[] = []
    for (
      let d = dir;
      d !== 0;
      d = at.get(shape.path[d].slice(0, Math.max(0, shape.path[d].lastIndexOf('/')))) ?? 0
    ) {
      chain.push(d)
      if (chain.length > 64) break
    }
    shape.ancestors[i] = Int32Array.from(chain)
  })
  shaped = shape
  return shape
}

/** The path indices under one scope — see `frameTree`'s `scope`.
 *
 *  Memoised per timeline and scope, because it is a property of the path table rather than
 *  of the frame: a replay rebuilds its tree thirty times a second and this changes only when
 *  somebody drills. A file scope matches itself; a directory matches everything beneath it,
 *  segment-wise, or `web/src` takes in `web/src-old`. */
let scoped: { hist: Tables; scope: string; at: Set<number> } | null = null
export function scopeOf(hist: Tables, scope: string): Set<number> {
  if (scoped && scoped.hist === hist && scoped.scope === scope) return scoped.at
  const at = new Set<number>()
  const under = `${scope}/`
  hist.paths.forEach((p, i) => {
    if (p === scope || p.startsWith(under)) at.add(i)
  })
  scoped = { hist, scope, at }
  return at
}

/** Path string → its index, so a container can look up its own arrival by node id. Built
 *  once per timeline rather than per frame: it is a property of the scan, and a replay
 *  rebuilds this tree thirty times a second. */
let index: { hist: Tables; at: Map<string, number> } | null = null
export function pathIndexOf(hist: Tables): Map<string, number> {
  if (index && index.hist === hist) return index.at
  const at = new Map<string, number>()
  hist.paths.forEach((p, i) => at.set(p, i))
  index = { hist, at }
  return at
}
