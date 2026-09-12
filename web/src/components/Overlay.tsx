import type { ReactNode } from 'react'

/** Dimmed backdrop that centers a modal panel. Clicking the backdrop closes; the panel
 *  itself must stop propagation so clicks inside don't.
 *
 *  `opaque` paints the window's own ground instead of a dim, for a dialog whose work rearranges
 *  what is behind it — the report re-roots and redraws the map for every figure it copies, and
 *  watching that through a dimmed pane is the machinery showing. The map is copied from its
 *  markup, not from the screen, so covering it changes nothing in the file. */
export function Overlay({
  children,
  onClose,
  opaque = false,
}: {
  children: ReactNode
  onClose: () => void
  opaque?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: opaque ? 'var(--background)' : 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      {children}
    </div>
  )
}
