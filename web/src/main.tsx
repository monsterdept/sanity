import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CodeWindow } from './CodeWindow'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {code && repo ? <CodeWindow repo={repo} relPath={code} /> : <App />}
  </StrictMode>,
)

// Take the splash down once there is something behind it.
//
// After a frame, not immediately: `render` schedules the work rather than performing it,
// so removing the splash on the next line can uncover a root that has not painted yet —
// which is the white flash again, moved. Faded rather than cut, and removed from the
// document afterwards so it cannot sit over the app swallowing clicks if the transition
// never fires.
const splash = document.getElementById('splash')
if (splash) {
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      splash.classList.add('is-gone')
      setTimeout(() => splash.remove(), 400)
    }),
  )
}
