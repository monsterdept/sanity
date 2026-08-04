import { useEffect, useState } from 'react'
import { isTauriMac, onFullscreenChange } from '../../lib/runtime'
import { Wordmark } from '../Wordmark'

/** Top-left cell of the T-shape. Same height as the TopRow so the two read as one
 *  horizontal strip across the window, broken only by the sidebar gutter. Under Tauri on
 *  macOS the overlay traffic lights sit here, so the wordmark is pushed clear of them. */
export function SideBarHeader() {
  // The reserve is for the overlay traffic lights, and macOS hides those in fullscreen —
  // holding the gap open there strands the wordmark in the middle of an empty gutter.
  const [fullscreen, setFullscreen] = useState(false)
  useEffect(() => onFullscreenChange(setFullscreen), [])

  return (
    <div
      data-tauri-drag-region
      className="shell-chrome relative flex select-none items-center"
      style={{
        height: 'var(--titlebar-h)',
        // 3px in from the reserve. The reserve is sized for the traffic lights; the
        // wordmark only has to clear them, and sitting flush against that boundary read
        // as further right than the sidebar's own left margin.
        paddingLeft: isTauriMac() && !fullscreen ? 'calc(var(--traffic-light-reserve) - 3px)' : 9,
      }}
    >
      {/* Click-through, so the wordmark doesn't punch a dead spot in the drag region —
          Tauri drags only when the event target itself carries the attribute. */}
      <div className="pointer-events-none flex items-center leading-none">
        <Wordmark />
      </div>
    </div>
  )
}
