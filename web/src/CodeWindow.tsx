import { useEffect, useState } from 'react'
import { CodeView } from './components/CodeView'
import { listProjects, projectScan, type Node } from './lib/api'

/** Find a file node by its repo-relative path. */
function fileByPath(node: Node, path: string): Node | null {
  if (node.kind === 'file' && node.path === path) return node
  for (const c of node.children) {
    const hit = fileByPath(c, path)
    if (hit) return hit
  }
  return null
}

/**
 * The whole window, when the window IS one file's code view.
 *
 * Spawned by `open_code_window` with `?code=` and `?repo=` set. It loads the same bundle
 * as the main window rather than being a second entry point — one build, two shapes.
 *
 * It re-resolves the file from the scan the app already holds instead of being handed a
 * node: a window is a separate JS context with no access to the other one's state, and
 * serialising a subtree through a URL would put a copy of the reading somewhere it could
 * silently go stale.
 */
export function CodeWindow({ repo, relPath }: { repo: string; relPath: string }) {
  const [file, setFile] = useState<Node | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => document.documentElement.classList.toggle('dark', mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    let live = true
    void listProjects()
      .then(async (list) => {
        const project = list.projects.find((p) => p.repo === repo)
        if (!project) throw new Error('That repo is no longer open in sanity.')
        const scan = await projectScan(project.key)
        if (!scan) throw new Error('No scan for that repo.')
        const hit = fileByPath(scan.root, relPath)
        if (!hit) throw new Error(`${relPath} is not in the scan.`)
        if (live) setFile(hit)
      })
      .catch((e) => live && setError(String(e)))
    return () => {
      live = false
    }
  }, [repo, relPath])

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)] p-6">
        <p className="max-w-[40ch] text-center text-sm text-[var(--muted-foreground)]">{error}</p>
      </div>
    )
  }
  if (!file) {
    return (
      <div className="flex h-full items-center justify-center bg-[var(--background)] p-6">
        <p className="text-sm text-[var(--muted-foreground)]">Opening {relPath}…</p>
      </div>
    )
  }

  return (
    <div className="relative h-full bg-[var(--background)]">
      {/* The strip the overlay traffic lights sit in, and the handle for the window.
          Everything inside it is click-through: Tauri drags only when the EVENT TARGET
          carries the attribute, so a label that takes its own pointer events is a dead
          patch in the middle of the only draggable part of the window. */}
      <div
        data-tauri-drag-region
        className="shell-chrome chrome-surface flex shrink-0 select-none items-center border-b border-[var(--border)] text-[11px] text-[var(--muted-foreground)]"
        style={{
          height: 'var(--titlebar-h)',
          paddingLeft: 'calc(var(--traffic-light-reserve) - 3px)',
        }}
      >
        <span className="mono pointer-events-none truncate">{relPath}</span>
      </div>
      <div className="relative" style={{ height: 'calc(100% - var(--titlebar-h))' }}>
        {/* No pop-out and no close: this window IS the code view, and spawning another
            of itself or closing its own only content are both nonsense. The window
            controls do that job. */}
        <CodeView file={file} repo={repo} selected={null} reveal={null} onSelect={() => {}} />
      </div>
    </div>
  )
}
