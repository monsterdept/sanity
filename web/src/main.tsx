import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CodeWindow } from './CodeWindow'
import { applyStoredTheme } from './lib/theme'
import './index.css'

// Before the first render, not in an effect. `index.html` hardcodes `class="dark"` so
// there is a ground on frame one rather than a flash of unstyled document — but that is a
// guess, and it is the wrong guess for anyone in light mode. Applying the stored
// preference here replaces the guess before anything is painted.
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
