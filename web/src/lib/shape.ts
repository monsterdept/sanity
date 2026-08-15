import { listen } from '@tauri-apps/api/event'
import type { Node } from './api'

/**
 * The repo taking shape, while the scan that describes it is still running.
 *
 * **A scan is four phases and only one of them was ever on screen.** The walk finds files,
 * tree-sitter parses them, `git blame` reads per-line history — minutes on a large C++ tree
 * — and then everything is scored and folded into a tree. None of that reported anything:
 * the progress bar in the window is wired to the model pass, which the app has not run
 * since `OllamaModel` was removed, so a first open of a big repo was a still bar over an
 * empty pane for as long as it took.
 *
 * What the window draws instead is the thing it is for. Files stream out of the parse as
 * they land, a directory at a time, and the sunburst assembles itself: the repo's shape
 * arrives long before its readings do, which is exactly what the scan learns first.
 *
 * **Grey, and that is not a placeholder.** Width is lines and colour is a reading; a scan in
 * flight has the first and not the second, and the map already has a way of saying so. The
 * assembling rings are the same neutral as any unread wedge, so nothing on screen claims a
 * measurement that has not been taken.
 */
export interface ShapeFile {
  /** Repo-relative. The directories are built from it. */
  path: string
  lang: string
  /** `[name, lines]` per function, in file order. */
  funcs: [string, number][]
}

export function onScanShape(cb: (files: ShapeFile[]) => void): () => void {
  const un = listen<ShapeFile[]>('scan-shape', (e) => cb(e.payload))
  return () => {
    void un.then((f) => f())
  }
}

function dirNode(path: string, name: string, kind: 'dir' | 'file'): Node {
  return {
    id: path,
    name,
    kind,
    path,
    loc: 0,
    line: null,
    endLine: null,
    lang: null,
    excluded: false,
    lastAuthor: null,
    doc: null,
    score: null,
    body: null,
    hotspots: [],
    children: [],
  }
}

/**
 * Fold the files that have arrived so far into a tree the sunburst can draw.
 *
 * Rebuilt from the whole accumulated list on every batch rather than patched in place. It is
 * O(files) against a repo that is by definition still arriving, and the alternative — a
 * mutable tree threaded through a React state update — is the same bug the frame pool is
 * written up against: the sunburst re-lays out when the node it is rooted at changes
 * identity, so the root has to be a fresh object anyway.
 *
 * Sizes are summed up the ancestry, which is all `Node.loc` means. No `score` is set
 * anywhere: absent is the honest value, and every lens draws it as the unread neutral.
 */
export function shapeTree(files: ShapeFile[], repoName: string): Node {
  const root = dirNode('', repoName, 'dir')
  const dirs = new Map<string, Node>([['', root]])

  const dirFor = (path: string): Node => {
    const found = dirs.get(path)
    if (found) return found
    const cut = path.lastIndexOf('/')
    const parent = dirFor(cut === -1 ? '' : path.slice(0, cut))
    const made = dirNode(path, cut === -1 ? path : path.slice(cut + 1), 'dir')
    dirs.set(path, made)
    parent.children.push(made)
    return made
  }

  for (const f of files) {
    const cut = f.path.lastIndexOf('/')
    const file = dirNode(f.path, cut === -1 ? f.path : f.path.slice(cut + 1), 'file')
    file.lang = f.lang
    for (const [name, loc] of f.funcs) {
      file.children.push({
        ...dirNode(`${f.path}#${name}`, name, 'file'),
        kind: 'func',
        path: f.path,
        lang: f.lang,
        loc,
      })
      file.loc += loc
    }
    dirFor(cut === -1 ? '' : f.path.slice(0, cut)).children.push(file)
  }

  // Ancestors last, so a directory's size is the sum of everything under it however deep.
  const sum = (n: Node): number => {
    if (n.kind !== 'dir') return n.loc
    n.loc = n.children.reduce((t, c) => t + sum(c), 0)
    return n.loc
  }
  sum(root)
  return root
}
