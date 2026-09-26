# A headless CLI

**Status:** shipped in 0.33.0. Every release carries `sanity-<version>-<target>` archives for Linux x86-64 and ARM64, macOS ARM64 and Windows x86-64 and ARM64, 15.2 to 17.0MB each, and `sanity-action@v2` runs them on all five. What differs from the plan below:

- **Every target builds natively on a GitHub-hosted runner**, as the app bundles do, so there is no cross-compiling. The Linux builds run on Ubuntu 22.04, which sets their glibc floor at 2.35; the musl question in phase 4 was never needed.
- **Releases come from GitHub, not `dl.dept.monster`**, and `just publish` is gone. Phase 4's copy step and publish check went with it; `headless.yml` checks each binary's `--version` against the tag before uploading.
- **Two edges the plan did not name.** A headless build is a Windows console program: `windows_subsystem = "windows"` applies only under `gui`, or `sanity.exe` would print nothing. And `sanity .`, which opens a repo in the window, says a headless build has no window to open it in.

## Summary

**The same `sanity`, every verb, with the window compiled out.** CI runs `sanity verify` today by downloading the Linux AppImage: 146MB compressed and 1.06GB unpacked, to run one verb that never opens a window. A build made with `--no-default-features` would carry every CLI verb (`init`, `check`, `status`, `summary`, `findings`, `trace`, `callers`, `export-data`, `refresh`, `verify`, `serve`, `mcp`) and no Tauri, WebKit or GTK.

It is for places the app is not installed: CI runners and Linux servers. On a desktop the app stays the only `sanity`. That split is what keeps the one-binary rule's intent (see *The rule this bends*).

Two pieces of work fall out, and the first is worth doing on its own: **the dev tools stop shipping in the app bundle**, which is most of what the AppImage weighs.

## What ships today

Measured on `Sanity_0.31.0_amd64.AppImage`:

| Contents | Unpacked |
|---|---|
| `sanity-findings`, `sanity-tokens`, `sanity-sample`, `sanity-history` | ~640MB (~160MB each) |
| `usr/bin/sanity` | 182MB |
| WebKit, JavaScriptCore, ICU, GTK, librsvg and the rest of the UI stack | ~180MB |
| Total | 1.06GB (146MB compressed) |

The four dev tools are Cargo `[[bin]]` targets in the app crate, and the Tauri bundler ships every binary the crate builds. Nothing starts them from an installed app: every caller is a `just` recipe using `cargo run --bin` (`history`, `findings`, `tokens`, `sample`). `conventions.md` already warns not to put `Contents/MacOS` on PATH because they live there, so the macOS bundle carries them too.

**Speed is not why this is worth doing.** On the krapow runner, unpacking and verifying takes about 2 seconds and the download about 6, cached per version. The reasons are:

- **Portability.** The AppImage runs on Linux x86-64 only. A plain binary can ship for macOS, ARM and Windows runners, and for CI that is not GitHub's.
- **No AppImage workarounds.** Its launcher changes into its own `usr/`, so a relative repo path scanned the app instead of the checkout (the action's first real run). It needs `libfuse2` or `APPIMAGE_EXTRACT_AND_RUN=1`, and it unpacks 1GB into `/tmp` on every call.
- **Size.** Estimated at around a quarter of today's download, because the tree-sitter grammars remain. Not yet measured; see phase 2.

## Phases

### 1. The dev tools leave the bundle

Independent of the rest, and it shrinks every download, the DMG included.

- Move the four dev tools out of the app crate into a crate of their own beside it, depending on `sanity_lib`. The bundler then has nothing to pick up. Check first whether `tauri.conf.json` can exclude binaries instead; nothing in the current config does.
- The `just` recipes change from `--bin sanity-history` to that crate's manifest. Nothing else calls them.
- **Measure:** the AppImage and DMG sizes before and after, on a release build. *Measured on macOS, binaries only: the three tools were 159, 156 and 159MB beside a 178MB `sanity`, so about 474MB of the 652MB the bundle carried. The DMG and AppImage themselves are measured on the first release built from this.*
- `conventions.md`'s warning about `Contents/MacOS` loses its reason and is rewritten.

### 2. A `gui` feature

- A default-on `gui` feature in `src-tauri/Cargo.toml` gates `tauri`, its plugins and `tauri-build`, `commands.rs`, and `lib::run()`. Tauri appears in only those two files today; `agentapi.rs` mentions it in a comment.
- The CLI borrows four plain helpers from `commands.rs`: `stamp_reports`, `repo_head`, `repo_remote` and `languages`, all for `export-data`. They move to a module both builds compile, so `commands.rs` holds only the `#[tauri::command]` wrappers.
- `build.rs` runs `tauri_build::build()` only under `gui`.
- **Measure:** a `--no-default-features --release` binary on Linux and macOS, raw and gzipped. That number decides whether the grammars need a look of their own. *macOS: 166MB raw, 16.7MB gzipped (16.1MB stripped), against 178MB for the app binary. So Tauri was about 12MB and the rest is the parser, mostly grammar tables, which compress about ten to one. Linux is measured by the release job.*
- `just test` builds both ways, so a headless build that stops compiling fails CI rather than a release.

### 3. What changes in a headless build

Every verb behaves the same. Three edges:

- **`sanity` with no arguments** opens the window. Headless, it prints help and one line saying this build has no window.
- **`init --show`** posts `/open` with focus to whatever backend answers. With no app running there is nothing to show, so it is a no-op. It needs no code change, only its help text.
- **Two builds retire each other's idle daemon.** `build_id` is the version plus the binary's size and mtime, so a GUI and a headless build of one version count as different. A `check` from one asks an idle headless daemon of the other to stand down, and is refused while a wave runs. That is the same bouncing as mixing versions today, and it only happens on a machine with both installed, which the placement below avoids.

### 4. Release and distribution

- A release job builds `--no-default-features` for Linux x86-64 and ARM64, macOS ARM64 and Windows x86-64, and uploads `sanity-<version>-<target>.tar.gz` (`.zip` on Windows) to the draft beside the bundles. `just publish` copies them to `dl.dept.monster` with the rest.
- The version stamping that release.yml does for the app applies to this build too, and `just publish`'s check that a bundle reports its own version gets a headless equivalent (`sanity --version` from the tarball).
- **Open:** whether the Linux build should be static (musl) so it runs on old glibc. That depends on the C grammars building under musl, which has not been tried.
- No second Homebrew package. The cask keeps providing `sanity` from the app.

### 5. The action switches over

- `monsterdept/sanity-action` downloads the tarball for the runner's OS and architecture, drops `APPIMAGE_EXTRACT_AND_RUN`, the absolute-path workaround and the Linux-x86-64-only refusal, and ships as `v2`. Tarballs exist only from the release that ships them, so `v2` refuses older versions. `v1` keeps working, because the AppImage keeps shipping.
- The README's *Anywhere else* section downloads the tarball instead of the AppImage.

## The rule this bends

`conventions.md` says the app and the CLI are one binary because "a second installable that could drift from this one is the `mcp/sanity.mjs` mistake with a longer fuse." The worry is two versions writing `.sanity/`.

A feature flag keeps **one implementation**: same source, same version, built by the same release job, so the two builds cannot disagree about the format. It does make **a second installable**. So the placement is part of the design, not a detail:

- **Desktop:** the app, installed by the cask, is the only `sanity`.
- **Headless:** only where the app is not installed, meaning CI and servers.

The note is rewritten in the phase that ships the tarball, saying exactly that. A headless install beside the app on a desktop is the drift the rule warns about, and nothing would show it: a reading records who took it, with which agent and model, but not which build wrote it. `just expiry` is what keeps a version gap harmless in the common case, since most releases change nothing a reading is taken against.

## Not traded away

- **Every verb works headless.** A trimmed CLI with only `verify` would be a third thing to keep in step; the point is the same program without a window.
- **One version number.** The headless build is never released on its own.
- **`.sanity/` is written the same way by both.** No verb gets a headless-only path.
