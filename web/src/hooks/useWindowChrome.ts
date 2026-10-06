import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { cliStatus, installCli, onInstallCli, onSetTheme, syncThemeMenu, type Node } from '../lib/api'
import { dismissSplash } from '../lib/splash'
import { marked } from '../lib/stopwatch'
import { loadTheme, saveTheme, watchSystemTheme, type Theme } from '../lib/theme'

/** Pieces of the window that belong to no project: the webfont, the appearance menu, the
 *  developer context menu, the command-line install, and the splash coming down. Each is a
 *  subscription with no consumer but the window itself, and `useWindow` is all of them. */

/** The window's own concerns, called last.
 *
 *  **Last because nothing here feeds anything else.** The webfont's revision is read only by
 *  the map's labels, at render; the theme, the context menu and the CLI link are listeners on
 *  the document and the menu; and the splash and the stopwatch are about the moment the rest
 *  has settled, so their inputs come from every layer before them. React runs a component's
 *  own effects after its children's whatever order its hooks are in, so moving these to the
 *  end changed nothing a child sees. */
export function useWindow(
  setCliLink: Dispatch<SetStateAction<CliLink | null>>,
  { shapeRoot, projectsLoaded }: { shapeRoot: Node | null; projectsLoaded: boolean },
  { focus, tree }: { focus: Node | null; tree: Node | null },
) {
  const faceRev = useFaceRev()
  useTheme()
  useNoDevMenu()
  useCliInstall(setCliLink)

  /** The splash comes down here, not after the first paint. See `lib/splash.ts`.
   *
   *  Ready means the window has something true to say. That used to be a MAP — or, with the
   *  list fetched and genuinely empty, the card telling you how to get one — and everything
   *  else was the app booting, which the wordmark covered.
   *
   *  **The wait grew a picture, and the wordmark was sitting on it.** A first scan of a large
   *  repo now names what it is reading, moves a real bar as files are parsed and blamed, and
   *  draws the map assembling out of the parse. All of that happened under the splash: six
   *  seconds of wordmark, then two of a bar, then the finished map — the two things built to
   *  describe the wait, shown for the moment after it ended.
   *
   *  So the list arriving is enough. At that point the sidebar has its projects, the pane has
   *  the project it is waiting on, and neither is a guess. */
  const booted = focus !== null || shapeRoot !== null || projectsLoaded
  useEffect(() => {
    if (booted) dismissSplash()
  }, [booted])
  // Where a launch's time actually went. See `lib/stopwatch.ts`. Its marks are taken during
  // render, so whichever layer takes one, it lands before this prints them.
  useEffect(() => {
    if (tree) marked()
  }, [tree])

  return { faceRev }
}

  /** **One redraw when the webfont lands.**
   *
   *  Every label on the map is laid out against a measured advance, and until the face
   *  arrives those measurements are the fallback's — see `widthPerPx`, whose cache now keeps
   *  the two apart. Keeping them apart is not enough on its own: nothing re-renders when a
   *  font loads, so whatever was drawn during the wait keeps its wrong geometry until
   *  something unrelated happens to redraw it. The dial showed it plainly, painting
   *  `found 67` as `ound 67` — a `textPath` sized to a narrower face clips what overflows,
   *  silently. */
export function useFaceRev(): number {
  const [faceRev, setFaceRev] = useState(0)
  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && setFaceRev((n) => n + 1)).catch(() => {})
    return () => {
      live = false
    }
  }, [])
  return faceRev
}

// Defaults to following the system; View → Appearance overrides it. The app used to
// follow the system with no way to override, on the argument that a toggle is a second
// place for the preference to live — true, but it also made it impossible to look at
// the other ground without changing the machine's, which is what you want when shooting
// the app or checking that both palettes actually render.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(loadTheme)
  useEffect(() => watchSystemTheme(theme), [theme])
  // Appearance is a menu, not a panel — see `build_menu`. Rust emits the choice; the
  // preference and its persistence stay here, and the menu's checkmarks are told what
  // they should read rather than being trusted to remember.
  useEffect(
    () =>
      onSetTheme((t) => {
        const next = t as Theme
        setTheme(next)
        saveTheme(next)
      }),
    [],
  )
  useEffect(() => {
    void syncThemeMenu(theme)
  }, [theme])
}

/** WebKit's own context menu, which is Reload and Inspect Element, does not ship.
 *
 *  It is a developer menu — pressing Reload in a Tauri window throws away the scan and
 *  looks like a crash — and it appeared everywhere, including on rows where right-click
 *  now means something. Suppressed in release only: Inspect Element is how this UI gets
 *  worked on, and losing it in `just dev` would cost more than the menu does.
 *
 *  Not suppressed over text. Right-clicking a selection or a field is how somebody
 *  copies an id out of the model box or a path out of the detail panel, and taking that
 *  away to hide two developer items would be a worse trade than leaving them. */
export function useNoDevMenu() {
  useEffect(() => {
    if (import.meta.env.DEV) return
    const block = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null
      if (el?.closest('input, textarea, select, [contenteditable]')) return
      if (window.getSelection()?.toString()) return
      e.preventDefault()
    }
    document.addEventListener('contextmenu', block)
    return () => document.removeEventListener('contextmenu', block)
  }, [])
}

/** What the menu's Install Command Line Tool… reported, if anything. Split into a
 *  sentence and a path so the path can be set as code rather than the whole message
 *  being set as a transcript. */
export type CliLink = { text: string; path?: string }

/** The menu's Install Command Line Tool…, carried out, with its outcome raised as a dialog —
 *  whose state is `useOverlays`'s. */
export function useCliInstall(setCliLink: Dispatch<SetStateAction<CliLink | null>>) {
  useEffect(
    () =>
      onInstallCli(() => {
        void installCli()
          .then(() =>
            // Asked rather than inferred from the write: a link was made, and which
            // `sanity` a shell reaches is a different question — another install can come
            // first on PATH.
            cliStatus().then((c) =>
              setCliLink(
                c.is_this_app
                  ? // No backticks. They are Markdown in a string that is rendered as HTML,
                    // so they arrive as literal punctuation — and the convention they come
                    // from is one a reader of this dialog has no reason to know.
                    {
                      text: 'Installed. The sanity command now runs this app, at',
                      path: c.resolved ?? undefined,
                    }
                  : c.resolved
                    ? {
                        text: 'Linked, but your shell still runs another build first:',
                        path: c.resolved,
                      }
                    : {
                        text: 'Linked, but no shell can find it yet — add its directory to your PATH.',
                      },
              ),
            ),
          )
          .catch((e) => setCliLink({ text: String(e) }))
      }),
    [],
  )
}
