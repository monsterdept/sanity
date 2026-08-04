import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Tauri drives this: `beforeDevCommand` runs `npm run dev` and points the webview at
// devUrl (5173). A fixed port + strictPort so the shell can rely on it.
//
// Every build prints a >500kB chunk warning for MascotFigure — that chunk is
// neo-mascots plus three.js, ~1.2MB, and it is ALREADY the fix the warning recommends:
// components/AgentMascot lazy-imports it so it never lands in the startup path. The
// warning is left switched on deliberately. `chunkSizeWarningLimit` is global, so
// raising it to cover this one known chunk would also silence a genuine regression in
// the main bundle, which is the number actually worth watching (~210kB).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
