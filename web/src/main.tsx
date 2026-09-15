import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CodeWindow } from './CodeWindow'
import { dismissSplash } from './lib/splash'
import { installMono } from './lib/monoFaces'
import { applyStoredTheme } from './lib/theme'
import './index.css'

// Before the first render, not in an effect. `index.html` already put the ground on the
// document from the same stored key, so this is not what prevents the flash — it is what
// keeps the answer in one place once the module that owns it exists. Idempotent by
// construction: both read `sanity.theme` and toggle the same class.
applyStoredTheme()

// One bundle, two shapes. A window spawned by `open_code_window` carries `?code=` and
// renders only that file; everything else is the app. Read here rather than inside App
// so the two never share state they have no business sharing — a popped-out window is a
// separate JS context, and treating it as a route within the app would invite exactly
// that confusion.
const params = new URLSearchParams(window.location.search)
const code = params.get('code')
const repo = params.get('repo')

// **The monospace face before the first render**, because a canvas measures in whatever face has
// loaded and the widths it takes are cached: a path measured in a fallback and drawn in the real
// face overruns. Capped, so a face that never arrives cannot hold the window on its splash screen.
void Promise.race([installMono(), new Promise((done) => setTimeout(done, 1500))]).then(mount)

function mount() {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>{code && repo ? <CodeWindow repo={repo} relPath={code} /> : <App />}</StrictMode>,
  )

  // Take the splash down once there is something behind it — and "something" is not the
  // first paint. `App` calls `dismissSplash` when it has a map or a first-run card; see
  // `lib/splash.ts` for why the frame is the wrong event to hang this on.
  //
  // A popped-out code window has no such moment: it fetches one file and that is the whole
  // of it, so it keeps the old rule. After a frame, not immediately — `render` schedules the
  // work rather than performing it, so uncovering the root on the next line can reveal one
  // that has not painted, which is the white flash again, moved.
  if (code && repo) {
    requestAnimationFrame(() => requestAnimationFrame(dismissSplash))
  } else {
    // The cap, so a backend that never answers cannot leave somebody staring at a wordmark
    // with no way to reach the window behind it. Long enough that a cold start reaches its
    // own map first on any machine this has been run on; short enough to be a hitch rather
    // than a hang.
    setTimeout(dismissSplash, 8000)
  }
}
