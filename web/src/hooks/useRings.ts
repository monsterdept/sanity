import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { fileFunctions, readIntoRing, type Held, type Node } from '../lib/api'

/** The half of the function rings that has to exist before the map does: what has arrived,
 *  grafted into the tree the map is drawn from. What to ASK for depends on where the map is
 *  standing, which is `useRingFetch`, below. */
export function useRingGraft({
  drawn,
  readings,
  readingRev,
  activeKey,
  treeRev,
}: {
  drawn: Node | null
  readings: RefObject<Held>
  readingRev: number
  activeKey: string | null
  treeRev: number
}) {
  /**
   * The functions of the files the map is drawing, fetched as it needs them.
   *
   * **A repo's worth of functions is not a thing a window can be handed.** Ceph's tree is
   * 75MB of JSON, 113,322 functions, five seconds of parsing — and the map at that size is
   * directories and files, with the layout rolling three and a half thousand files up as too
   * thin to draw before it ever reaches their insides. So the tree arrives without them (see
   * `Node::slim`) and a file's ring is asked for when there is somewhere to put it.
   *
   * Which files: the ones wide enough to show an inside, judged the way the layout judges
   * it — a share of the focused subtree — plus whatever is drilled into or open in the code
   * view. On a small repo that is every file, one round trip each, and the map fills in
   * within a frame or two of opening. On ceph it is a few dozen.
   */
  const [fns, setFns] = useState<Map<string, Node[]>>(new Map())
  /** What the MAP has asked for, held as a list so the fetch below can union it in.
   *
   *  Compared before it is stored, on the rule every poll in this file follows: the map
   *  reports on each layout, and a fresh array naming the same paths would re-run a fetch
   *  effect that walks the focused subtree, on every one of them. */
  const [wanted, setWanted] = useState<readonly string[]>([])
  const wantRings = useCallback((paths: readonly string[]) => {
    setWanted((prev) =>
      prev.length === paths.length && prev.every((p, i) => p === paths[i]) ? prev : [...paths],
    )
  }, [])
  const asked = useRef(new Set<string>())
  /** Which project the fetches above belong to, for answers that outlive the click that
   *  asked for them. */
  const activeRef = useRef<string | null>(null)
  activeRef.current = activeKey
  /** Rings that have arrived and are waiting to be spliced in together.
   *
   *  **Drilling asks for every file in a directory at once, and each answer used to cost a
   *  rebuild of the whole repo.** `filled` walks the tree to graft, so applying sixty
   *  answers one at a time walked linux's tree sixty times, re-laid the sunburst out sixty
   *  times, and re-rendered every arc sixty times — for one drill. That is the delay, and it
   *  scales with how interesting the directory is.
   *
   *  Batched on the same argument as the shape stream, and drained
   *  BEFORE the updater rather than inside it: an updater with a side effect is called twice
   *  under StrictMode and the second call keeps the result — which is how the assembling map
   *  came to stay empty for a whole afternoon. */
  const landed = useRef<Map<string, Node[]>>(new Map())
  useEffect(() => {
    // A different project is a different set of paths, and holding another repo's would
    // graft its functions onto a file with the same name.
    //
    // A new TREE for the same project clears them too: the first map of a launch comes from
    // the cache before the backend holds the functions to answer with (see
    // `AppState::shallow`), so those fetches come back empty. Kept, they would be a file
    // whose ring never arrives — the emptiness cached as if it were an answer.
    //
    // **`treeRev`, and emphatically not `scan`.** A tree ARRIVING is what invalidates these;
    // `scan` also changes every time readings are folded into the tree
    // already on screen, which is a new object describing the same files. Keyed on `scan`,
    // this fired on the 2s reading poll: a repo with any readings at all threw away every
    // function ring twice a minute, redrew without them, and re-fetched — a map at rest
    // flickering on a two-second period, which is the timer's signature and not the
    // renderer's. Measured off a screen recording: 891 functions, then 0, then 891.
    asked.current.clear()
    landed.current = new Map()
    setFns(new Map())
  }, [activeKey, treeRev])
  /** Files already grafted, by the node they were grafted onto — see below. */
  const graftCache = useRef<Map<Node, { ring: Node[]; out: Node }>>(new Map())
  /** The tree with whatever rings have arrived spliced in.
   *
   *  Rebuilt when a fetch lands rather than mutated: every consumer below memoises on the
   *  tree's identity, and a mutation would leave the map, the panel and the percentiles each
   *  believing a different version of the same repo. */
  const filled = useMemo(() => {
    if (!drawn || fns.size === 0) return drawn
    // Rebuilt each run and swapped in at the end rather than added to: a cache keyed on tree
    // nodes that is only ever written to holds every version of every file the window has
    // drawn since it opened.
    const nextGrafts = new Map<Node, { ring: Node[]; out: Node }>()
    // **Only the branches that changed are rebuilt.** It cloned every node it walked, so a
    // ring arriving for one file in `drivers/net/ethernet/mellanox` produced a fresh copy of
    // all of linux — tens of thousands of objects — and handed every consumer below a tree
    // whose every node was new, defeating each of their memos in turn. Returning `n` itself
    // when nothing underneath it moved keeps the untouched 99% shared by reference, which is
    // what those memos are for; identity still changes all the way up from a real graft, so
    // the rule this rests on holds — a node is a new object exactly when it means something
    // new.
    const graft = (n: Node): Node => {
      if (n.kind === 'file') {
        const got = fns.get(n.path)
        // **Readings are folded in HERE, and nothing else reaches these nodes.** The tree
        // being grafted into has already been through `applyAgentReports`, which ran when it
        // held no functions at all — so a ring spliced in raw is a ring whose readings never
        // arrive, which is how a repo reporting 69.9% read drew as entirely unread.
        // `readIntoRing` returns the same array when nothing moved, so a reading poll that
        // changed nothing does not rebuild the file.
        if (!got) return n
        const ring = readIntoRing(got, readings.current.byId)
        // **The same file back when its ring is the ring it already had.** The splice itself
        // allocated unconditionally, so every file the map had fetched a ring for — and every
        // directory above it, all the way to the root — became a new object each time this
        // memo ran, which is each time anything anywhere in the tree moved. Keyed on the
        // node this is grafting INTO, which is stable now that `pruneExcluded` hands back
        // what it was given.
        const was = graftCache.current.get(n)
        const out = was && was.ring === ring ? was.out : { ...n, children: ring, funcs: 0 }
        nextGrafts.set(n, { ring, out })
        return out
      }
      let moved = false
      const kids = n.children.map((c) => {
        const next = graft(c)
        if (next !== c) moved = true
        return next
      })
      return moved ? { ...n, children: kids } : n
    }
    const out = graft(drawn)
    graftCache.current = nextGrafts
    return out
    // `readingRev` and not `readings`: the ref is mutated in place so its identity never
    // changes, and the counter is what says a poll brought something new — see `keepReadings`.
  }, [drawn, fns, readingRev])
  useEffect(() => {
    const timer = setInterval(() => {
      const batch = landed.current
      if (batch.size === 0) return
      landed.current = new Map()
      setFns((prev) => {
        const next = new Map(prev)
        for (const [path, got] of batch) next.set(path, got)
        return next
      })
    }, 120)
    return () => clearInterval(timer)
  }, [])

  return { filled, fns, wanted, wantRings, asked, landed, activeRef }
}

export function useRingFetch({
  activeKey,
  focus,
  codeFile,
  fns,
  wanted,
  asked,
  landed,
  activeRef,
}: {
  activeKey: string | null
  focus: Node | null
  codeFile: string | null
  fns: Map<string, Node[]>
  wanted: readonly string[]
  asked: RefObject<Set<string>>
  landed: RefObject<Map<string, Node[]>>
  activeRef: RefObject<string | null>
}) {
  /** Ask for the rings the map is about to draw.
   *
   *  Runs on what is FOCUSED, not on the whole repo: drilling into a directory is exactly
   *  the gesture that makes its files wide enough to have insides, and a policy written
   *  against the root would fetch the same few dozen files whatever you were looking at.
   *
   *  `MIN_SHARE` is the layout's own threshold, one ring out: a wedge below about a
   *  quarter of a degree is not drawn, so a file below that share of its parent has no
   *  inside worth having. The code view's file is always asked for, because that one is not
   *  a wedge at all. */
  useEffect(() => {
    if (!activeKey || !focus) return
    const MIN_SHARE = 0.0025
    const want: string[] = []
    const walk = (n: Node) => {
      if (n.kind === 'file') {
        if (n.funcs > 0 && n.loc / Math.max(focus.loc, 1) >= MIN_SHARE) want.push(n.path)
        return
      }
      for (const c of n.children) walk(c)
    }
    walk(focus)
    // **And whatever the MAP says it has room for.** The share above is a stand-in for that
    // question, asked by the one party that cannot see the answer — see `onWantRings`. It
    // stays as the opening guess, because it needs no picture to have been drawn yet; what
    // it cannot do is be right about a repo of four million lines, where a quarter of a per
    // cent is ten thousand and it refuses every file there is. Unioned rather than swapped:
    // what the map can hold is the better answer only once there IS a map.
    for (const path of wanted) want.push(path)
    if (codeFile) want.push(codeFile)

    const key = activeKey
    // **`asked` means IN FLIGHT, and `fns` is the record of what arrived.** It used to mean
    // "asked for at some point", which is the same thing only while nothing is ever dropped
    // — and rings are dropped, every time a tree arrives and the clear below empties `fns`.
    // A path caught between landing and being flushed was then in neither: not in `fns`, so
    // nothing drew it, and still in `asked`, so nothing asked again. The panel sat empty
    // until something unrelated moved. Split, the same accident is self-correcting: a ring
    // that goes missing is a path that is neither held nor in flight, which is exactly the
    // condition for asking.
    //
    // **One call for the whole drill.** Rust finds these by walking the tree, so asking file
    // by file walked all of linux once per file — see `fileFunctions`.
    const fresh = want.filter((path) => !fns.has(path) && !asked.current.has(path))
    if (fresh.length === 0) return
    for (const path of fresh) asked.current.add(path)
    void fileFunctions(key, fresh)
      .then((got) => {
        for (const path of fresh) asked.current.delete(path)
        // Ignore an answer for a project nobody is looking at any more: the fetch is slow
        // enough to outlive a click on another row.
        if (activeRef.current !== key) return
        // **Parked, not applied.** Applying them as they arrive meant one rebuild of the
        // tree apiece — see `landed`.
        for (const [path, ring] of got) landed.current.set(path, ring)
      })
      .catch(() => {
        for (const path of fresh) asked.current.delete(path)
      })
    // `fns` is a dependency because it is now half the question: what has arrived decides
    // what is still worth asking for, so a flush has to re-open it.
  }, [activeKey, focus, codeFile, fns, wanted])
}
