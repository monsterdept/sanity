import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CodeWindow } from './CodeWindow'
import './index.css'

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
