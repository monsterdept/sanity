import type { ReactNode } from 'react'

/** The right column's top strip.
 *
 *  Same height as SideBarHeader; together they read as one continuous bar across the
 *  window, broken only by the sidebar gutter.
 *
 *  It used to carry a tab rail, an open button and a theme toggle. The tabs were the
 *  problem: closing one removed it from the rail without closing the project, so the rail
 *  and the sidebar disagreed about what was open and the sidebar was the one telling the
 *  truth. Two lists of the same thing, one of them lying. The open button moved to the
 *  empty state, where opening something is the only thing you could want, and the theme
 *  follows the system rather than offering a preference the OS already holds.
 *
 *  What it holds now is the colour-mode switcher, centred, with the whole strip around it
 *  a drag region — the control sits in the chrome and the chrome is still a handle. Tauri
 *  drags only when the EVENT TARGET carries the attribute, so the buttons keep taking
 *  their own clicks without opting out of anything.
 */
export function TopRow({ children }: { children?: ReactNode }) {
  return (
    <header
      data-tauri-drag-region
      className="shell-chrome flex shrink-0 select-none items-center justify-center"
      style={{ height: 'var(--titlebar-h)' }}
    >
      {children}
    </header>
  )
}
