import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Tauri drives this: `beforeDevCommand` runs `npm run dev` and points the webview at
// devUrl (5173). A fixed port + strictPort so the shell can rely on it.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // **harfbuzzjs finds its wasm beside its own module** (`new URL('harfbuzz.wasm', import.meta.url)`).
  // Pre-bundled into `.vite/deps` it looked beside the bundle instead, got the app's HTML back, and
  // aborted at import — which, loaded at startup, held the window on the splash screen.
  optimizeDeps: { exclude: ['harfbuzzjs'] },
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
