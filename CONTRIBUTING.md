# Contributing

## Sending a change

There are three ways in, depending on what you want to send and how you feel about copyright.

- **Tell me about it.** For a small fix, you don't have to send code. Open an issue describing the bug and the fix, and I'll write it. Nothing about copyright changes hands, and there's no paperwork.
- **Send a pull request under the CLA.** [CLA.md](CLA.md) assigns me the copyright in your contribution, gives you back the right to use your own work however you like, and promises that Sanity stays under the GPL. Agreeing is one line in your pull request's description.
- **Talk to me.** If you'd like to work on Sanity seriously and a CLA isn't something you'll sign, I'm open to discussing it, including contributing under the GPL and keeping your own copyright. Open an issue, and we'll work out something that suits us both. The one thing any arrangement has to include: text Sanity writes into other people's repos, such as the `.sanity/README.md` template and the rule descriptions, is released under CC0, so your changes to it would be too.

## Building from source

```sh
just setup                      # once: frontend dependencies and the Tauri CLI (needs Rust and Node)
just dev                        # run the app
just cli findings ../some-repo  # run the CLI built from this checkout
```

On Linux, install the WebKit and GTK development packages first: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev`.

`just check` type-checks. `just test` runs the same steps as CI, in the same order, so if it passes locally, CI will pass.
