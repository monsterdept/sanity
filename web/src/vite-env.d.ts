/// <reference types="vite/client" />

// Vite's own ambient types, which the project had been doing without because nothing had
// yet imported an asset by URL or as text. `?raw` is what the empty state's wordmark uses:
// the mark's fills are `currentColor`, and an `<img>` cannot inherit one, so the markup has
// to be inlined rather than referenced.
