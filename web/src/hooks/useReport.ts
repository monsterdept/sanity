import { useCallback, useEffect, useMemo, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { fileFunctions, onExportReport, readIntoRing, type Held, type Node } from '../lib/api'
import { legendFor } from '../lib/colorMode'

/** What File → Export Report as PDF… takes from the window: the languages for its methodology,
 *  and the tree with every function in it, fetched for the export alone. */
export function useReport({
  filled,
  activeRef,
  treeRef,
  readings,
  reporting,
  setReporting,
}: {
  filled: Node | null
  activeRef: RefObject<string | null>
  treeRef: RefObject<Node | null>
  readings: RefObject<Held>
  /** Whether the dialog is up — `useOverlays`'s, raised here by the menu. */
  reporting: boolean
  setReporting: Dispatch<SetStateAction<boolean>>
}) {
  /** The languages present, largest first, for the report's methodology. Walked only while the
   *  dialog is up, and off the live tree rather than whatever a report has staged. */
  const reportLangs = useMemo(
    () => (reporting && filled ? legendFor(filled, 'language') : []),
    [reporting, filled],
  )
  /**
   * The tree with every function in it, for what a report counts and names.
   *
   * **A report's numbers were the window's, and the window holds what it has drawn.** Rings are
   * fetched for files wide enough to show an inside, so a report's tables ranked the functions
   * earlier pages had happened to fetch — and its own zoomed findings pages fetched more. A
   * report, then a brief of the same commit twelve seconds later, named different most-complex
   * functions and counted 84 and then 99 unread. So a report asks for every ring once, grafts
   * readings in the way `filled` does, and reads its tables off that. Nothing on screen holds
   * it: it lives as long as the export.
   */
  const completeTree = useCallback(async (): Promise<Node | null> => {
    const key = activeRef.current
    const base = treeRef.current
    if (!key || !base) return null
    const paths: string[] = []
    const want = (n: Node) => {
      if (n.kind === 'file') {
        if (n.funcs > 0) paths.push(n.path)
        return
      }
      n.children.forEach(want)
    }
    want(base)
    if (paths.length === 0) return base
    const got = await fileFunctions(key, paths)
    const graft = (n: Node): Node => {
      if (n.kind === 'file') {
        const ring = got.get(n.path)
        // An empty answer is a backend that does not hold the functions yet (see the clear on
        // `treeRev`), not a file without any — kept as it was, its count still stands.
        return ring && ring.length > 0
          ? { ...n, children: readIntoRing(ring, readings.current.byId), funcs: 0 }
          : n
      }
      let moved = false
      const kids = n.children.map((c) => {
        const next = graft(c)
        if (next !== c) moved = true
        return next
      })
      return moved ? { ...n, children: kids } : n
    }
    return graft(base)
  }, [])
  useEffect(() => onExportReport(() => setReporting(true)), [])

  return { reportLangs, completeTree }
}
