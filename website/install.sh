#!/bin/sh
# Install Sanity. https://sanity.monster
#
#   curl -fsSL https://sanity.monster/install.sh | sh
#       Linux: the app, as one file that is also every `sanity` command.
#
#   curl -fsSL https://sanity.monster/install.sh | sh -s -- --headless
#       Linux or macOS: every `sanity` command and no window, for servers and CI.
#
# On macOS the app comes from Homebrew or the .dmg, and on Windows from the installer; this
# script says so rather than guessing. It installs into ~/.local/bin (SANITY_INSTALL_DIR to
# change that), never asks for root, and fetches the latest release unless SANITY_VERSION or
# --version=<v> names one.
set -eu

repo="monsterdept/sanity"
dir="${SANITY_INSTALL_DIR:-$HOME/.local/bin}"
version="${SANITY_VERSION:-}"
headless=0

say() { printf '%s\n' "$*" >&2; }
die() { say "sanity install: $*"; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --headless) headless=1 ;;
    --version=*) version="${arg#--version=}" ;;
    -h|--help)
      say "Install Sanity into ${dir}."
      say "  (no options)    Linux: the app, which is also every sanity command"
      say "  --headless      Linux or macOS: every sanity command, no window"
      say "  --version=<v>   a specific release, not the latest"
      exit 0 ;;
    *) die "unknown option '$arg' (try --headless or --version=<v>)" ;;
  esac
done

command -v curl >/dev/null 2>&1 || die "needs curl"

case "$(uname -m)" in
  x86_64|amd64) arch=x86_64 ;;
  aarch64|arm64) arch=aarch64 ;;
  *) die "there is no build for $(uname -m)" ;;
esac

os="$(uname -s)"
case "$os" in
  Linux) ;;
  Darwin)
    if [ "$headless" = 0 ]; then
      die "on macOS, install the app with 'brew install --cask monsterdept/tap/sanity' or the .dmg from https://sanity.monster. Add --headless for the build without a window."
    fi
    [ "$arch" = aarch64 ] || die "there is no build for Intel Macs"
    ;;
  MINGW*|MSYS*|CYGWIN*) die "on Windows, use the installer from https://sanity.monster" ;;
  *) die "there is no build for $os" ;;
esac

# The latest release is where github.com/<repo>/releases/latest redirects to. Asked of the
# redirect rather than the API, which rate-limits anonymous callers.
if [ -z "$version" ]; then
  latest="$(curl -fsSLI -o /dev/null -w '%{url_effective}' "https://github.com/$repo/releases/latest")" \
    || die "could not reach GitHub to find the latest release"
  version="${latest##*/v}"
  case "$version" in
    [0-9]*) ;;
    *) die "could not tell the latest release from $latest" ;;
  esac
fi
version="${version#v}"
base="https://github.com/$repo/releases/download/v$version"

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM
mkdir -p "$dir"

if [ "$headless" = 1 ]; then
  command -v tar >/dev/null 2>&1 || die "needs tar"
  case "$os" in
    Linux) target="$arch-unknown-linux-gnu" ;;
    Darwin) target="aarch64-apple-darwin" ;;
  esac
  # 0.33.0 named these sanity-<v>-<target>; every release after it adds `headless`.
  for name in "sanity-headless-$version-$target" "sanity-$version-$target"; do
    if curl -fsSL -o "$tmp/sanity.tar.gz" "$base/$name.tar.gz" 2>/dev/null; then
      tar -xzf "$tmp/sanity.tar.gz" -C "$tmp"
      break
    fi
  done
  [ -f "$tmp/sanity" ] || die "Sanity $version has no headless build for $target"
  mv "$tmp/sanity" "$dir/sanity"
else
  # The bundler names the x86-64 AppImage `amd64` and the ARM one `aarch64`, and drops a
  # prerelease suffix from the version.
  case "$arch" in x86_64) suffix=amd64 ;; aarch64) suffix=aarch64 ;; esac
  app="Sanity_${version%%-*}_${suffix}.AppImage"
  curl -fsSL -o "$tmp/sanity" "$base/$app" || die "could not download $base/$app"
  mv "$tmp/sanity" "$dir/sanity"
fi
chmod +x "$dir/sanity"
say "Installed Sanity $version at $dir/sanity"

# An AppImage mounts itself with FUSE 2, which newer distros no longer install by default.
if [ "$headless" = 0 ] && ! (ldconfig -p 2>/dev/null | grep -q 'libfuse\.so\.2'); then
  say "It needs libfuse2 to start (Debian/Ubuntu: sudo apt install libfuse2). Without it, set APPIMAGE_EXTRACT_AND_RUN=1."
fi

case ":$PATH:" in
  *":$dir:"*) say "Run 'sanity .' in a repo to open it." ;;
  *) say "$dir is not on your PATH. Add it, then run 'sanity .' in a repo." ;;
esac
