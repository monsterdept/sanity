import type { Finding, FindingGroup, Say } from './api'

/** One thing to look at, and every rule that said so. */
export interface FindingItem {
  finding: Finding
  /** The rules that raised it, in lockstep with `says` — index `i` is the same rule in both. */
  rules: FindingGroup[]
  says: Say[][]
  /** Per rule, in the same lockstep: whether that rule's reading is out of date. */
  stale: boolean[]
  /** Flagged under ANY of its rules: the tile is the thing somebody committed to. */
  flagged: boolean
}

/** One tile per SUBJECT, not per finding.
 *
 *  **A function that three rules flagged is one thing to look at, not three.** Grouped by
 *  rule, `App.tsx` appeared under Giant function, Tangled for its size and Hard to read —
 *  the same body, three rows, and a reader counting the work sees three jobs. Merged, the
 *  rules become what the tile SAYS about it, which is also the more useful sentence: this
 *  is long, and knotty, and nobody could read it.
 *
 *  Ranked by lines, which is the axis the whole map is already sized by. Not by how many
 *  rules fired — two rules is not twice as bad, and a count of coincidences is a severity
 *  claim the instrument cannot support.
 *
 *  **Here rather than in the panel, because the report lists the same work.** A second merge
 *  would be a second join, and the day the two disagreed a PDF would number a different list
 *  from the one on screen. */
export function mergeFindings(groups: FindingGroup[] | null): FindingItem[] {
  if (!groups) return []
  const by = new Map<string, FindingItem>()
  for (const g of groups) {
    if (g.blocked) continue
    for (const l of g.hits) {
      const at = by.get(l.key)
      if (at) {
        at.rules.push(g)
        at.says.push(l.says)
        at.stale.push(l.stale)
        at.flagged = at.flagged || l.flagged
      } else
        by.set(l.key, { finding: l, rules: [g], says: [l.says], stale: [l.stale], flagged: l.flagged })
    }
  }
  // Widest, then key — the same order the backend ranks each rule by, applied again here
  // because merging by subject shuffles them back together. **A flag does not move a tile.**
  // Flagging used to sort the tile to the front, so the row you clicked jumped out from under
  // the pointer and the list you were reading down reordered itself around it; a flag is a
  // note about what you mean to do, not a claim that this body is wider than the ones above.
  return [...by.values()].sort(
    (a, b) => b.finding.hit.loc - a.finding.hit.loc || a.finding.key.localeCompare(b.finding.key),
  )
}

/** The tile each rule says its background under — see `FindingGroup.background`.
 *
 *  **Computed over the list rather than remembered while drawing it.** A `Set` mutated
 *  inside the render would make the paragraph a function of how many times React chose to
 *  render, which is not something a reader can see and not something that stays true under
 *  a StrictMode double pass. Built here, the answer is the same however often the list is
 *  drawn: the FIRST tile in the order already on screen, which is the one somebody reads
 *  first.
 *
 *  Keyed by rule id and not by title — a title is prose and gets rewritten, which is the
 *  same reason a dismissal is not filed under one. */
export function introductions(items: FindingItem[]): Map<string, string> {
  const at = new Map<string, string>()
  for (const { finding, rules } of items) {
    for (const r of rules) {
      if (r.background && !at.has(r.id)) at.set(r.id, finding.key)
    }
  }
  return at
}

/** What could not be asked, one line per REASON rather than one per rule.
 *
 *  **Seven rules each ending in the same six words is one fact printed seven times.** An
 *  unread repo blocks every rule with a reading clause in it, and the footer listed them:
 *  seven rows whose right-hand halves were identical, which reads as seven problems and
 *  buries the count that matters — how much of the catalog is dark, and what single thing
 *  would light it. This is the panel's version of the rule the map already follows: a
 *  repo-level answer is said once, not repeated on every segment.
 *
 *  Folded by the FIX rather than by the sentence, because the fix is the decision: an
 *  untraced repo blocks Blame on one sentence and Churn on another, and *press Trace* is one
 *  job either way. The sentences and the rule names hang on the row's tooltip, where
 *  somebody who wants to know which seven, and why each, can find out.
 *
 *  Counted against the whole catalog, because `7 of 19` is the sentence with a decision in
 *  it and a bare `7` is not. */
export function blockedByNeed(
  groups: FindingGroup[] | null,
): { need: string; rules: string[]; whys: string[] }[] {
  const by = new Map<string, { rules: string[]; whys: Set<string> }>()
  for (const g of groups ?? []) {
    if (!g.blocked) continue
    const at = by.get(g.blocked.need)
    if (at) {
      at.rules.push(g.title)
      at.whys.add(g.blocked.why)
    } else by.set(g.blocked.need, { rules: [g.title], whys: new Set([g.blocked.why]) })
  }
  return [...by.entries()]
    .map(([need, v]) => ({ need, rules: v.rules, whys: [...v.whys] }))
    .sort((a, b) => b.rules.length - a.rules.length || a.need.localeCompare(b.need))
}

/** How many findings somebody has already set aside, over every rule. */
export function setAsideCount(groups: FindingGroup[] | null): number {
  return groups?.reduce((n, g) => n + g.dismissed, 0) ?? 0
}

/** Where a finding is, as far as grouping is concerned. */
export interface Placed {
  path: string
  kind: 'dir' | 'file' | 'func'
}

/** Findings that are presented together, and where the map zooms to show them. */
export interface PlaceGroup<T> {
  /** A directory's path, `''` for the repo, or a file's path when `kind` is `file`. */
  root: string
  kind: 'dir' | 'file'
  items: T[]
}

/** Past this many findings a directory is split into its own sub-places. It is a reason to
 *  split, not a cap: a place with nothing under it to split into stays one group however many it
 *  holds, because the alternative is the same map drawn twice. */
export const GROUP_MAX = 8
/** Below this a directory's findings are pooled with their neighbours' rather than given a map
 *  of their own. */
export const GROUP_MIN = 3

const parentOf = (p: string) => {
  const i = p.lastIndexOf('/')
  return i < 0 ? '' : p.slice(0, i)
}

/** The tightest place that shows every one of these: the file, when they are all functions in
 *  one file; otherwise the deepest directory holding all their files. A file finding is the
 *  file's wedge, which is drawn on its directory's map and not on its own. */
function rootOf(places: Placed[]): { root: string; kind: 'dir' | 'file' } {
  const files = [...new Set(places.map((p) => p.path))]
  if (files.length === 1 && places.every((p) => p.kind === 'func')) {
    return { root: files[0], kind: 'file' }
  }
  let common: string[] | null = null
  for (const f of files) {
    const segs = parentOf(f).split('/').filter(Boolean)
    if (!common) {
      common = segs
      continue
    }
    let i = 0
    while (i < common.length && i < segs.length && common[i] === segs[i]) i++
    common = common.slice(0, i)
  }
  return { root: (common ?? []).join('/'), kind: 'dir' }
}

/**
 * Findings grouped by where they are, for a report that shows each group on its own map.
 *
 * **By place, because a place is what somebody owns and works in.** Grouping by rule answers
 * "what kind of trouble", which is one page's worth of insight; grouping by rank answers
 * nothing. A directory is a unit a person is responsible for, and a map zoomed to it gives each
 * wedge the room a whole-repo map could not.
 *
 * Top-down: a directory holding no more than `max` is one group, zoomed as tightly as its
 * findings allow. A bigger one is split by what is directly under it — each subdirectory and
 * each file — and a part with fewer than `min` is pooled with the other small parts at this
 * level rather than given a page of its own. Nothing else is ever split: a file, or a pool, past
 * `max` stays one group. **No two groups share a place.**
 *
 * `items` are expected widest first (`mergeFindings`), and that order is kept inside a group and
 * between groups: a group goes where its widest finding would have.
 */
export function groupFindings<T>(
  items: T[],
  placeOf: (t: T) => Placed,
  max = GROUP_MAX,
  min = GROUP_MIN,
): PlaceGroup<T>[] {
  const index = new Map<T, number>()
  items.forEach((t, i) => index.set(t, i))
  const byIndex = (a: T, b: T) => index.get(a)! - index.get(b)!
  const make = (list: T[]): PlaceGroup<T> => ({ ...rootOf(list.map(placeOf)), items: list })
  /** The thing directly under `dir` that holds `t`: a subdirectory, or the file itself. */
  const childOf = (dir: string, t: T): { child: string; file: boolean } => {
    const p = placeOf(t).path
    if (dir && !p.startsWith(`${dir}/`)) return { child: p, file: true }
    const rel = dir ? p.slice(dir.length + 1) : p
    const cut = rel.indexOf('/')
    return cut < 0 ? { child: p, file: true } : { child: (dir ? `${dir}/` : '') + rel.slice(0, cut), file: false }
  }
  const build = (dir: string, list: T[]): PlaceGroup<T>[] => {
    if (list.length <= max) return [make(list)]
    const buckets = new Map<string, { file: boolean; list: T[] }>()
    for (const t of list) {
      const { child, file } = childOf(dir, t)
      const b = buckets.get(child)
      if (b) b.list.push(t)
      else buckets.set(child, { file, list: [t] })
    }
    const out: PlaceGroup<T>[] = []
    const pool: T[] = []
    for (const [child, b] of buckets) {
      // Only a directory splits. A file has no sub-places, so past the cap it stays whole — a
      // denser figure, where runs of it were the same figure drawn again.
      if (b.list.length > max && !b.file) out.push(...build(child, b.list))
      else if (b.list.length >= min) out.push(make(b.list))
      else pool.push(...b.list)
    }
    if (pool.length) out.push(make(pool.sort(byIndex)))
    return out
  }
  // **A place is one group.** The first version chunked an oversized pool into runs of `max`,
  // and a report of styx came out with `internal (8)` and `internal (5)` as groups B and H: the
  // same map twice, split by rank — the "next eight" grouping this function exists to replace.
  // Merged by place rather than prevented at each level, because a file finding's group roots at
  // the file's directory and can meet the directory's own pool from a different branch.
  const merged = new Map<string, PlaceGroup<T>>()
  for (const g of build('', [...items])) {
    const k = `${g.kind}:${g.root}`
    const at = merged.get(k)
    if (at) at.items.push(...g.items)
    else merged.set(k, { ...g, items: [...g.items] })
  }
  const groups = [...merged.values()]
  for (const g of groups) g.items.sort(byIndex)
  const first = (g: PlaceGroup<T>) => Math.min(...g.items.map((t) => index.get(t)!))
  return groups.sort((a, b) => first(a) - first(b))
}

/** True where a group is holding back rows the wire did not carry — see `PER_GROUP`. With
 *  calibrated thresholds this should not happen; if it does, the tile count is short and
 *  says so rather than quietly under-reporting the work. */
export function rowsCapped(groups: FindingGroup[] | null): boolean {
  return groups?.some((g) => g.total > g.hits.length) ?? false
}
