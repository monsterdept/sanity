import { openCodeWindow, type Node } from '../lib/api'
import type { ColorMode, Views } from '../lib/colorMode'
import { CodeView } from './CodeView'

/** The code, over the map. Modal because reading a file is a detour from the
 *  picture and not a new place in it — Escape and the backdrop both put it down,
 *  and the pop-out promotes it to a window when it stops being a detour. */
export function CodeOverlay({
  codeNode,
  repoPath,
  selected,
  reveal,
  viewMode,
  authorRank,
  langRank,
  lensViews,
  setPicked,
  setCodeFile,
}: {
  codeNode: Node
  repoPath: string | null
  selected: Node | null
  reveal: { id: string; n: number } | null
  viewMode: ColorMode
  authorRank: Map<string, number> | null
  langRank: Map<string, number> | undefined
  lensViews: Views
  setPicked: (n: Node) => void
  setCodeFile: (id: null) => void
}) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-8 py-14"
      onClick={() => setCodeFile(null)}
      onKeyDown={(e) => e.key === 'Escape' && setCodeFile(null)}
    >
      <div
        // Capped, and inset from the window on every side. Code wants a measure, not
        // the full width of a display — and a sheet that reaches the window's edges
        // reads as a new screen rather than as something laid over the map you are
        // still in.
        className="relative h-full w-full max-w-[860px] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CodeView
          file={codeNode}
          repo={repoPath}
          selected={selected}
          reveal={reveal}
          mode={viewMode}
          ranks={
            (viewMode === 'blame' ? authorRank : viewMode === 'language' ? langRank : null) ??
            undefined
          }
          views={lensViews}
          onSelect={(n) => setPicked(n)}
          onPopOut={() => {
            if (repoPath) void openCodeWindow(repoPath, codeNode.path)
            setCodeFile(null)
          }}
          onClose={() => setCodeFile(null)}
        />
      </div>
    </div>
  )
}
