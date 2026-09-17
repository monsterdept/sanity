import { useCallback, useEffect, useMemo, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { fileFunctions, type Hit, type Node } from '../lib/api'
import { findById, parentOf } from '../lib/tree'
import { sameNodes, useSteady } from './useSteady'

/** Moving around the map: what is selected and open, the ancestry the crumbs and the panel
 *  draw, and every gesture that re-roots the rings — a drill, a crumb, a `→` in the panel, a
 *  search result. */
export function useNavigation({
  tree,
  focus,
  setStack,
  picked,
  setPicked,
  codeFile,
  setCodeFile,
  setReveal,
  activeKey,
  asked,
  landed,
  activeRef,
  treeRef,
}: {
  tree: Node | null
  focus: Node | null
  setStack: Dispatch<SetStateAction<string[]>>
  picked: Node | null
  setPicked: Dispatch<SetStateAction<Node | null>>
  codeFile: string | null
  setCodeFile: Dispatch<SetStateAction<string | null>>
  setReveal: Dispatch<SetStateAction<{ id: string; n: number } | null>>
  activeKey: string | null
  asked: RefObject<Set<string>>
  landed: RefObject<Map<string, Node[]>>
  activeRef: RefObject<string | null>
  treeRef: RefObject<Node | null>
}) {
  const codeNode = useMemo(
    () => (tree && codeFile ? findById(tree, codeFile) : null),
    [tree, codeFile],
  )

  const selected = useMemo(
    () => (tree && picked ? (findById(tree, picked.id) ?? picked) : null),
    [tree, picked],
  )

  /** Stable identities, because an inline lambda makes the memo below do nothing. */
  const pick = useCallback((n: Node) => setPicked(n), [])
  const clearPick = useCallback(() => setPicked(null), [])

  /** Show me inside this. Shared by the ring and by the detail panel's contents list,
   *  so the gesture means the same thing wherever it is made. */
  const drill = useCallback(
    (n: Node) => {
      const tree = treeRef.current
      // A file drills like a directory: into its own ring, where its functions get the
      // whole circle instead of a 60px band. It used to jump straight to the source, and
      // that made "show me inside this" mean two different things one level apart —
      // descend for a directory, leave the map for a file. Reading the code is still one
      // gesture away, on the function you actually want; it is just no longer the only
      // thing a file can do.
      if (n.kind === 'func' && tree) {
        // A function has no view of its own — it lives in a file. Drilling one opens that
        // file and scrolls to it.
        const file = parentOf(tree, n.id)
        if (file) {
          setCodeFile(file.id)
          setPicked(n)
          setReveal((r) => ({ id: n.id, n: (r?.n ?? 0) + 1 }))
          return
        }
        // The overflow aggregate is synthesised at layout time, so it has no parent in
        // the tree and `parentOf` finds nothing. Drilling it means "show me the functions
        // you could not draw", which is the file's own ring — reached by its path, since
        // a file node's id IS its path.
        const owner = findById(tree, n.path)
        if (owner) {
          setStack((st) => [...st, owner.id])
          setPicked(owner)
          return
        }
        return
      }
      setStack((st) => [...st, n.id])
      setPicked(n)
    },
    [],
  )

  /** The ancestry of what is on screen: root first, focus last.
   *
   *  Walked up the TREE, not read off the drill stack. The stack records where you
   *  clicked, and drilling from the root straight into a nested directory puts one entry
   *  in it — so a crumb built from it read `cluster / Store` for a directory that
   *  actually lives at `Sources/ClusterCore/Store`. That is a history, and a history is
   *  not a location; the bar is supposed to answer "where am I", which only the tree
   *  knows.
   *
   *  Splitting the focused node's path string would be the other way, and it does not
   *  work: the scan collapses single-child directory chains, so the segments of a path
   *  do not all correspond to nodes. `parentOf` walks what is really there. */
  const trail = useMemo(() => {
    if (!tree || !focus) return []
    const out: Node[] = []
    let n: Node | null = focus
    while (n) {
      out.unshift(n)
      n = n.id === tree.id ? null : parentOf(tree, n.id)
    }
    return out
  }, [tree, focus])

  /** What CONTAINS the selection, root-side first and the repo itself left off.
   *
   *  Walked with `parentOf` rather than split off `node.path`, for the reason `trail` gives:
   *  the scan collapses single-child directory chains, so a path's segments are not all
   *  nodes. Splitting the string would produce crumbs that cannot be navigated to — which
   *  is the entire point of these ones.
   *
   *  Empty for anything the tree does not hold, which is the synthesised roll-up a file's
   *  band collapses into. The panel falls back to the plain path there rather than offering
   *  a route that does not exist. */
  const ownersNow = useMemo(() => {
    if (!tree || !selected) return []
    const out: Node[] = []
    let n = parentOf(tree, selected.id)
    while (n && n.id !== tree.id) {
      out.unshift(n)
      n = parentOf(tree, n.id)
    }
    return out
  }, [tree, selected])
  /** The walk allocates whether or not the answer moved, and the answer moves only when the
   *  selection does — see `useSteady`. */
  const owners = useSteady(ownersNow, sameNodes)

  /** Show the map this container, WITHOUT dropping the selection.
   *
   *  That is the one thing separating it from `goTo`, and it is the whole gesture: a
   *  function found from a list is a two-pixel sliver of a four-thousand-function ring, so
   *  the outline lands on something too small to see. Drilling to the file it lives in makes
   *  the same wedge a band — but only if the selection survives the trip, or you arrive
   *  somewhere correct with nothing marked. */
  const showIn = useCallback(
    (n: Node) => setStack(treeRef.current && n.id === treeRef.current.id ? [] : [n.id]),
    [],
  )

  /** Where a `→` in the panel is pointing, until the tree can answer it.
   *
   *  **A jump cannot be a single call, because the thing being jumped to may not exist yet.**
   *  The window is handed a tree with no functions in it (see `Node::slim`) and fetches each
   *  file's ring when the map has somewhere to draw it — so a caller two directories away is
   *  a name and a line, and nothing in the tree. Held as a REQUEST and resolved by the effect
   *  below, which runs again every time a ring lands: ask, wait, select. The alternative —
   *  awaiting the fetch inside the click — would have to splice the answer into the tree
   *  itself, which is `filled`'s job and would be a second grafting path to keep in step. */
  const [heading, setHeading] = useState<{ path: string; line: number } | null>(null)
  const jumpTo = useCallback((path: string, line: number) => setHeading({ path, line }), [])

  useEffect(() => {
    if (!heading || !tree || !activeKey) return
    // A file node's id IS its path — the same fact `drill` leans on for the overflow wedge.
    const file = findById(tree, heading.path)
    if (!file) {
      // Not in this tree at all: an excluded file, or a path from a scan the window has since
      // replaced. Dropped rather than left pending, or the next ring to land would resolve a
      // request nobody remembers making.
      setHeading(null)
      return
    }
    if (file.children.length === 0) {
      if (file.funcs === 0) {
        // Nothing to select inside it. The file itself is the honest landing place.
        setStack(file.id === tree.id ? [] : [file.id])
        setPicked(file)
        setHeading(null)
        return
      }
      // Ask, and come back when it lands. Through the same `asked`/`landed` pair the map's own
      // fetch uses, so a ring already in flight is not asked for twice and the answer is
      // spliced in one batch with everything else that arrives.
      if (!asked.current.has(heading.path)) {
        const path = heading.path
        asked.current.add(path)
        void fileFunctions(activeKey, [path])
          .then((got) => {
            asked.current.delete(path)
            if (activeRef.current !== activeKey) return
            for (const [p, ring] of got) landed.current.set(p, ring)
            // Nothing came back for it. Dropped rather than left pending: `asked` is cleared
            // above, so a request nobody can satisfy would otherwise sit here re-asking on
            // every tree that lands.
            if (!got.has(path)) setHeading(null)
          })
          .catch(() => {
            asked.current.delete(path)
            setHeading(null)
          })
      }
      return
    }
    // By LINE, which is what the panel had to point with: a name is not unique in a file —
    // a dozen `init`s, same-named methods in two `impl` blocks — and picking the first match
    // is how a jump lands on the wrong twin. Falling back to the file is better than landing
    // on a function nobody asked for.
    const target = file.children.find((f) => f.line === heading.line)
    setStack(file.id === tree.id ? [] : [file.id])
    setPicked(target ?? file)
    setHeading(null)
  }, [heading, tree, activeKey])

  /** Jump to any level of the ancestry. Index 0 is the root. */
  const goTo = useCallback(
    (i: number) => {
      setStack(i === 0 ? [] : [trail[i].id])
      setPicked(null)
    },
    [trail],
  )

  /** Go up exactly one level. The stack is rewritten to the parent's id rather than popped,
   *  because `focus` resolves the whole stack from the root every render — a single id is the
   *  canonical way to say "we are here". Undefined at the top, which is what hides the
   *  affordance. */
  const goUp = useMemo(() => {
    if (!tree || !focus || focus.id === tree.id) return undefined
    return () => {
      const p = parentOf(tree, focus.id)
      setStack(p && p.id !== tree.id ? [p.id] : [])
      setPicked(null)
    }
  }, [tree, focus])

  /** Take the map to a search result.
   *
   *  **Three kinds of hit, two mechanisms, and the reason is which of them may not exist in
   *  this window yet.** A container's id IS its path, so a directory or a file can be
   *  re-rooted directly. A function cannot: on a slimmed tree the window has never been sent
   *  one, so `jumpTo` is the right tool — it holds the request, asks for the file's ring, and
   *  selects the function when it lands. That machinery was built for the panel's `→` and it
   *  is exactly this problem, so this is a second caller rather than a second path.
   *
   *  A file goes through `jumpTo` too, with a line no function can have. It resolves to the
   *  file's own ring with the file selected, which is where drilling a file lands you — a
   *  search result and a click should not arrive at two different places.
   *
   *  Nothing found in the window's tree is dropped silently: the finder only offers what the
   *  backend's tree holds, and the two can differ for one moment after a rescan. Landing on
   *  the repo root would be a lie about having gone somewhere. */
  const flyTo = useCallback(
    (hit: Hit) => {
      if (!tree) return
      if (hit.kind === 'dir') {
        const dir = findById(tree, hit.path)
        if (!dir) return
        setStack(dir.id === tree.id ? [] : [dir.id])
        setPicked(dir)
        return
      }
      jumpTo(hit.path, hit.kind === 'func' ? hit.line : -1)
    },
    [tree, jumpTo],
  )

  return { codeNode, selected, pick, clearPick, drill, trail, owners, showIn, jumpTo, goTo, goUp, flyTo }
}
