import type { Node } from './api'

/** Find a node by id so the drill-in stack survives a rescan — the user's position in the
 *  tree shouldn't reset just because they re-ran the scan. */
export function findById(node: Node, id: string): Node | null {
  if (node.id === id) return node
  for (const c of node.children) {
    const hit = findById(c, id)
    if (hit) return hit
  }
  return null
}

/** The node one level up from `id`, or null at the root.
 *
 *  "Up" has to mean the tree's parent, not the previous stack entry. Drilling is a JUMP
 *  — double-clicking a file three rings out pushes a single entry — so popping the stack
 *  undoes the whole jump and lands you back at the top, however deep you had gone. */
export function parentOf(node: Node, id: string): Node | null {
  for (const c of node.children) {
    if (c.id === id) return node
    const hit = parentOf(c, id)
    if (hit) return hit
  }
  return null
}
