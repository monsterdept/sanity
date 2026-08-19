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

/** A batch, and the project it is about — see `scan::ShapeBatch`. */
export interface ShapeBatch {
  project: string
  files: ShapeFile[]
}

export function onScanShape(cb: (project: string, files: ShapeFile[]) => void): () => void {
  const un = listen<ShapeBatch>('scan-shape', (e) => cb(e.payload.project, e.payload.files))
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
    // The shape tree is what a scan streams while it is still running, so nothing has been
    // wired yet — call edges are resolved repo-wide once every file is parsed. Both wiring
    // lenses are gray until the real tree lands, which is the honest state: absent, not zero.
    callers: null,
    calls: null,
    incident: null,
    away: null,
    resolvable: null,
    orphans: null,
    sinks: null,
    cloneGroup: null,
    cloneSize: null,
    comparable: null,
    copied: null,
    children: [],
    funcs: 0,
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

  // **One entry per path, last wins.** The accumulator is cleared when a tree LANDS, so a
  // scan that starts over before one does — switching projects away and back, a watcher
  // rescan — appends a second copy of every file it has already streamed. That is a
  // duplicate id for the file wedge and for every function under it, which is the ghost
  // this whole function's ids are careful about one level down. Deduped rather than
  // guarded against upstream because a re-emitted file is genuinely the same file, and the
  // newer parse is the better one.
  const latest = new Map<string, ShapeFile>()
  for (const f of files) latest.set(f.path, f)

  for (const f of latest.values()) {
    const cut = f.path.lastIndexOf('/')
    const file = dirNode(f.path, cut === -1 ? f.path : f.path.slice(cut + 1), 'file')
    file.lang = f.lang
    // **A bare `path#name` is not unique, and here that is a ghost.** This is `key_of` in
    // `assessment.rs`, which the scan's own tree has always used and this one did not: one
    // file holds a dozen `init`s, a dozen `parse`s, and — the case that made it visible —
    // any C file with two definitions of one function under `#ifdef`/`#else`, which linux
    // has in almost every header. Two siblings with one id are two React children with one
    // key, and React's documented answer is that they "may be duplicated and/or omitted":
    // it loses track of the copy and never renders it again, leaving a wedge frozen where
    // it was born while the assembling map moves under it. Exactly the ghost the replay's
    // `#folded` roll-up produced, one namespace over — see `history.ts`.
    //
    // The ordinal is position within the file, so it matches what the real tree will mint
    // when the scan lands and the map does not re-key everything at the swap.
    const seen = new Map<string, number>()
    for (const [name, loc] of f.funcs) {
      const ord = seen.get(name) ?? 0
      seen.set(name, ord + 1)
      file.children.push({
        ...dirNode(ord === 0 ? `${f.path}#${name}` : `${f.path}#${name}#${ord + 1}`, name, 'file'),
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
