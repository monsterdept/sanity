import type { ReactNode } from 'react'

/** Dimmed backdrop that centres a modal panel. Clicking the backdrop closes; the panel
 *  itself must stop propagation so clicks inside don't. */
export function Overlay({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      {children}
    </div>
  )
}
