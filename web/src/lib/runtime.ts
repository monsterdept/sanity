// Lightweight runtime detection for the Tauri desktop shell. Deliberately does NOT import
// @tauri-apps/api at module load, so the same bundle still runs in a plain browser.

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown
  }
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const isMac = (): boolean =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)

/** True only inside the Tauri shell on macOS — where the overlay traffic lights float
 *  over the sidebar header and need room reserved. In a browser preview there are none,
 *  so reserving would just indent the wordmark for no reason. */
export const isTauriMac = (): boolean => isTauri() && isMac()

/** Whether the window is in macOS fullscreen, kept live.
 *
 *  Matters because the overlay traffic lights are HIDDEN in fullscreen — macOS only
 *  slides them in when the pointer reaches the top edge. The 92px reserved for them
 *  then becomes 92px of empty gutter with the wordmark stranded in the middle of it,
 *  which is what "traffic lights in the wrong place" looks like from the outside.
 *
 *  Polled off the window's own resize event rather than a timer: entering or leaving
 *  fullscreen always resizes, and nothing else needs to re-check. */
export function onFullscreenChange(cb: (full: boolean) => void): () => void {
  if (!isTauriMac()) return () => {}
  let stop: (() => void) | undefined
  let dead = false
  void (async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    const win = getCurrentWindow()
    const read = () => void win.isFullscreen().then((f) => !dead && cb(f))
    read()
    const un = await win.onResized(read)
    if (dead) un()
    else stop = un
  })()
  return () => {
    dead = true
    stop?.()
  }
}
