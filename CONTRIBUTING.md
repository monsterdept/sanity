# Contributing

## Building from source

```sh
just setup                      # once: frontend dependencies and the Tauri CLI (needs Rust and Node)
just dev                        # run the app
just cli findings ../some-repo  # run the CLI built from this checkout
```

On Linux, install the WebKit and GTK development packages first:
`libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev`.

`just check` type-checks. `just test` runs the same steps as CI, in the same order, so if it
passes locally, CI will pass.
