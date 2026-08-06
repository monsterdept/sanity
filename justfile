# Sanity — task runner. See docs/ARCHITECTURE.md.
#
# Shipping is two steps on purpose (same split as tally / metalbug):
#   just release <version>   validate + tag + push; CI builds all four targets,
#                            signs + notarizes the Mac bundle, and attaches
#                            everything to a GitHub release
#   just publish <version>   pull those bundles, verify, and distribute to
#                            dl.dept.monster + refresh the website
# publish runs from a workstation because it needs SSH to the servers — no
# server credential ever lives on GitHub, and CI never touches them.

# --- deployment targets ------------------------------------------------------
# Downloads: Hetzner, served by Caddy behind Cloudflare.
dl_host := env_var_or_default("SANITY_DL_HOST", "rturk@hz.rtrk.us")
dl_path := env_var_or_default("SANITY_DL_PATH", "/srv/dl.dept.monster/sanity")
dl_url  := "https://dl.dept.monster/sanity"
# Website: DreamHost (same as tally.monster / metalbug.monster / fussy).
site_host := env_var_or_default("SANITY_SITE_HOST", "rtrk@dreamy.rtrk.us")
site_path := env_var_or_default("SANITY_SITE_PATH", "sanity.monster/")
site_url  := "https://sanity.monster"
repo := "monsterdept/sanity"
# The department's shared tap — cluster, metalbug and tally already live here.
tap_repo := "monsterdept/homebrew-tap"

# Bare `just` lists the recipes.
default:
    @just --list

# Install frontend deps (once).
setup:
    cd web && npm install

# Open the app: Tauri dev shell + Vite dev server with hot reload.
# This is the human's to run — it opens a window.
dev:
    cd src-tauri && cargo tauri dev

alias run := dev

# Type-check + build the frontend only.
web:
    cd web && npm run build

# Fast gate: Rust type-checks + TypeScript type-checks (no bundling, no window).
check:
    cd src-tauri && cargo check
    cd web && npx tsc -b

# Full release bundle (needs the icon set — `just icons` first).
build:
    cd web && npm run build
    cd src-tauri && cargo tauri build

# Generate the icon set from a source PNG.
icons source="icons/source.png":
    cd src-tauri && cargo tauri icon {{source}}

# Everything CI runs, in CI's order — passing ⟹ CI passes (.github/workflows/ci.yml).
test:
    # Frontend first: `npm run build` is `tsc -b && vite build`, so it doubles as the
    # TypeScript type-check gate, and tauri-build reads web/dist while compiling src-tauri.
    cd web && npm run build
    cd src-tauri && cargo test
    cd src-tauri && cargo clippy --all-targets -- -D warnings

# Score a repo from the command line, no window. The fastest way to check whether the
# metric is doing anything real on a codebase you know — `just scan ../slooth`. Prints
# the hottest wedges, which is the only output that matters before the UI exists.
scan path="." *flags="":
    #!/usr/bin/env bash
    # Resolved to an absolute path BEFORE the cd: the crate lives in src-tauri/, so a
    # relative argument would otherwise be interpreted from there and `just scan .`
    # would quietly scan src-tauri instead of the repo you're standing in.
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    cd src-tauri && cargo run --quiet --bin sanity-scan -- "$target" {{flags}}

# Weigh what a reader pays for the context we write it — the tool descriptions, the
# subagent prompt, and the task payload for a real repo. At one function per reader the
# fixed prefix is paid once per FUNCTION, so a long `inputSchema` description is a
# per-reading charge. Run it before and after shortening one; guessing is how the
# descriptions got long in the first place.
tokens path=".":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    cd src-tauri && cargo run --quiet --bin sanity-tokens -- "$target"

# Cut N functions out of a repo as prediction exercises — `just sample ../ComfyUI /tmp/x 10`.
# Writes NN_head.md (what a reader is handed) and NN_body.txt (what it must predict), so the
# same function can go to several readers and their grades compared. Nothing touches
# `.sanity/`: measuring the reader is not assessing the repo.
sample path out n="10":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    out="$(mkdir -p "{{out}}" && cd "{{out}}" && pwd)"
    cd src-tauri && cargo run --quiet --bin sanity-sample -- "$target" "$out" {{n}}

# Clone neo-mascots at `ref` (branch/tag/sha; default main), build the lib, copy the
# bundle to web/src/lib/mascot.js. Vendored rather than depended on: it's a private repo,
# so a plain `npm install` on a fresh checkout (or in CI) can't fetch it. Same recipe as
# tally's and fussy's. The hand-written mascot.d.ts next to it declares only the surface
# we use, so re-check it after a bundle update.
mascot ref="main":
    #!/usr/bin/env bash
    set -euo pipefail
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    git clone --depth=1 --branch {{ref}} git@github.com:lapbar/neo-mascots.git "$tmp/neo-mascots"
    cd "$tmp/neo-mascots"
    npm install
    npm run build:lib
    cp dist/index.js "{{justfile_directory()}}/web/src/lib/mascot.js"
    # The habitat sheet runs the same creatures in its masthead, so one build feeds
    # both — the app and the site drifting to different mascot versions is the kind
    # of thing nobody notices until the site's crew stops rendering.
    cp dist/index.js "{{justfile_directory()}}/website/assets/mascot.js"
    echo "mascot.js updated from neo-mascots@{{ref}} (app + website)"

# Tag + push a release, e.g. `just release 0.1.0` (-suffix = prerelease).
release version:
    #!/usr/bin/env bash
    # Validates, tags v<version> with a changelog body, and pushes the tag → CI
    # (.github/workflows/release.yml) builds all four targets, signs/notarizes the
    # Mac bundle, and attaches everything to a GitHub release. The tag is the source
    # of truth — CI stamps the bundle version from it (no committed version bump).
    # Then run `just publish`.
    set -euo pipefail
    tag="v{{version}}"

    if [[ ! "{{version}}" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]]; then
        echo "error: '{{version}}' isn't semver (expected MAJOR.MINOR.PATCH[-pre])" >&2; exit 1
    fi
    if [[ -n "$(git status --porcelain)" ]]; then
        echo "error: working tree not clean — commit or stash first" >&2
        git status --short >&2; exit 1
    fi
    branch=$(git rev-parse --abbrev-ref HEAD)
    if [[ "$branch" != "main" ]]; then
        echo "error: must be on main (currently '$branch')" >&2; exit 1
    fi
    git fetch --quiet origin main
    if ! git diff --quiet HEAD origin/main; then
        echo "error: local main differs from origin/main — push or pull first" >&2; exit 1
    fi
    if git rev-parse "$tag" >/dev/null 2>&1; then
        echo "error: tag $tag already exists" >&2; exit 1
    fi

    # Annotate the tag with the commit log since the previous tag, so `git show
    # $tag` is useful even though the GitHub release body is generated.
    prev=$(git describe --tags --abbrev=0 2>/dev/null || true)
    if [[ -n "$prev" ]]; then
        body=$(printf '%s\n\nChanges since %s:\n\n%s\n' "$tag" "$prev" "$(git log --pretty='- %s' "$prev"..HEAD)")
    else
        body=$(printf '%s\n\n%s\n' "$tag" "$(git log --pretty='- %s')")
    fi
    if [[ "{{version}}" == *-* ]]; then
        echo "==> $tag is a prerelease — bundles publish, but don't run \`just publish\` on it"
    fi

    echo "==> tagging $tag"
    echo "$body" | sed 's/^/    /'; echo
    git tag -a "$tag" -m "$body"
    git push origin "$tag"
    echo "==> pushed. CI: https://github.com/{{repo}}/actions/workflows/release.yml"
    echo "    when it goes green:  just publish {{version}}"

# Distribute a released version to dl.dept.monster + the website (from a workstation).
publish version:
    #!/usr/bin/env bash
    # Pulls the signed bundles CI attached to the GitHub release, verifies the
    # macOS DMG (notarized + stapled), uploads all of them to dl.dept.monster,
    # then refreshes the site pinned to this version. Needs SSH to the servers —
    # split from `release` so no server credential ever lives on GitHub.
    set -euo pipefail
    VERSION="{{version}}"
    TAG="v$VERSION"
    DMG="Sanity_${VERSION}_aarch64.dmg"

    if [[ "$VERSION" == *-* ]]; then
        echo "error: $TAG is a prerelease — not publishable to real users" >&2; exit 1
    fi

    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT

    echo "==> Fetching $TAG bundles from GitHub"
    gh release download "$TAG" --repo {{repo}} --dir "$work"
    ls -1 "$work"

    # Verify the macOS bundle before distributing — the last point a bad build is
    # caught. (Linux/Windows bundles can't be verified from a Mac; they ride along.)
    # The DMG is notarized + stapled by CI.
    echo "==> Verifying $DMG"
    [ -f "$work/$DMG" ] || { echo "error: $DMG missing from the release" >&2; exit 1; }
    xcrun stapler validate "$work/$DMG" >/dev/null || { echo "error: DMG is not stapled/notarized" >&2; exit 1; }
    echo "    notarized + stapled"

    echo "==> Uploading to {{dl_host}}:{{dl_path}}"
    ssh "{{dl_host}}" "mkdir -p '{{dl_path}}'"
    scp "$work"/* "{{dl_host}}:{{dl_path}}/"

    # A download URL that 404s is worse than none — confirm the primary artifact
    # is actually reachable before pointing the site at it.
    echo "==> Checking {{dl_url}}/$DMG"
    code=$(curl -sL -o /dev/null -w '%{http_code}' "{{dl_url}}/$DMG")
    [ "$code" = "200" ] || { echo "error: {{dl_url}}/$DMG returned HTTP $code" >&2; exit 1; }
    echo "    reachable"

    # ── Homebrew cask ──
    #
    # Generated from the artifact we JUST verified and uploaded, not from the
    # release page: the sha256 has to describe the exact bytes brew will fetch
    # from {{dl_url}}, so it is taken from the served file rather than the local
    # copy. A cask whose checksum doesn't match what the URL serves fails on
    # every user's machine and nowhere else.
    echo "==> Updating the Homebrew cask"
    served_sha=$(curl -sL "{{dl_url}}/$DMG" | shasum -a 256 | awk '{print $1}')
    local_sha=$(shasum -a 256 "$work/$DMG" | awk '{print $1}')
    if [ "$served_sha" != "$local_sha" ]; then
        echo "error: {{dl_url}}/$DMG does not match the file we uploaded" >&2
        echo "    served $served_sha" >&2
        echo "    local  $local_sha" >&2
        exit 1
    fi

    git clone --depth 1 "https://github.com/{{tap_repo}}.git" "$work/tap"
    mkdir -p "$work/tap/Casks"
    {
    echo "# Generated by sanity's \`just publish\`. DO NOT EDIT."
    echo 'cask "sanity" do'
    echo "  version \"${VERSION}\""
    echo "  sha256 \"${served_sha}\""
    echo ''
    echo "  url \"{{dl_url}}/Sanity_#{version}_aarch64.dmg\""
    echo '  name "Sanity"'
    echo '  desc "See where the thinking in your codebase actually is"'
    echo "  homepage \"{{site_url}}\""
    echo ''
    echo '  # arm64 only — CI builds a single aarch64-apple-darwin bundle.'
    echo '  depends_on arch: :arm64'
    echo '  # Big Sur is the floor by arithmetic, not by choice: tauri.conf.json sets no'
    echo '  # minimumSystemVersion, and no earlier macOS ran on Apple Silicon.'
    echo '  depends_on macos: :big_sur'
    echo ''
    echo '  app "Sanity.app"'
    echo ''
    echo '  zap trash: ['
    echo '    "~/Library/Application Support/Sanity",'
    echo '    "~/Library/WebKit/sanity",'
    echo '    "~/Library/Preferences/monster.sanity.plist",'
    echo '    "~/Library/Saved Application State/monster.sanity.savedState",'
    echo '  ]'
    echo 'end'
    } > "$work/tap/Casks/sanity.rb"
    ruby -c "$work/tap/Casks/sanity.rb" >/dev/null

    cd "$work/tap"
    # Stage before comparing: `git diff` ignores untracked files, so the very
    # first cask would report "no change" and never be pushed.
    git add Casks/sanity.rb
    if git diff --staged --quiet; then
        echo "    cask already current"
    else
        git commit -q -m "sanity ${VERSION}"
        git push -q
        echo "    pushed to {{tap_repo}}"
    fi
    # Confirm the tap really serves this, rather than trusting the push. Read the file
    # back at the exact commit just pushed, and separately confirm the remote branch
    # points at that commit: raw.githubusercontent.com/<repo>/main/... is served from a
    # cache that can lag the branch by an hour, and reported a good push as a failure.
    # Commit SHAs are immutable, so that form is never stale, and ls-remote answers from
    # the git endpoint rather than the CDN.
    PUSHED=$(git rev-parse HEAD)
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
    REMOTE=$(git ls-remote origin "refs/heads/$BRANCH" | awk '{print $1}')
    if [ "$REMOTE" != "$PUSHED" ]; then
        echo "error: {{tap_repo}} $BRANCH is at ${REMOTE:-none}, expected $PUSHED" >&2
        exit 1
    fi
    published=$(curl -sL "https://raw.githubusercontent.com/{{tap_repo}}/$PUSHED/Casks/sanity.rb" \
        | awk -F'"' '/^  version/{print $2}')
    if [ "$published" != "$VERSION" ]; then
        echo "error: tap serves version '${published:-none}', expected $VERSION" >&2
        exit 1
    fi
    echo "    tap serves $published"
    cd - >/dev/null

    just _publish-site "$VERSION"
    echo
    echo "==> Published $TAG → {{dl_url}}/$DMG"
    echo "    brew install --cask monsterdept/tap/sanity"

# Deploy website/ to the site host, pinning every __VERSION__ to <version>.
_publish-site version:
    #!/usr/bin/env bash
    set -euo pipefail
    if [ -z "{{site_host}}" ] || [ -z "{{site_path}}" ]; then
        echo "==> Skipping website (SANITY_SITE_HOST / SANITY_SITE_PATH unset)"; exit 0
    fi
    work=$(mktemp -d)
    trap 'rm -rf "$work"' EXIT
    cp -R website/. "$work/"
    # mktemp -d is 0700; rsync -a would apply that to the web root → 403. Widen.
    chmod 755 "$work"; chmod -R a+rX "$work"
    # Pin downloads to an immutable, versioned URL (a mutable "latest" defeats
    # edge caching and can serve a stale artifact after a release).
    if [[ "$OSTYPE" == "darwin"* ]]; then SED=(sed -i ''); else SED=(sed -i); fi
    "${SED[@]}" "s/__VERSION__/{{version}}/g" "$work/index.html"
    if grep -q "__VERSION__" "$work/index.html"; then
        echo "error: unsubstituted __VERSION__ remains" >&2; exit 1
    fi
    echo "==> Deploying site to {{site_host}}:{{site_path}}"
    rsync -az --delete "$work/" "{{site_host}}:{{site_path}}/"
    echo "    {{site_url}}"

# Vite dev server in a plain browser (no Tauri backend — UI-only iteration).
web-dev:
    cd web && npm run dev

# Serve website/ locally and open it. The habitat sheet is plain static files, but it
# must be served rather than opened as file:// — the mascot bundle is an ES module, and
# a module fetched from file:// is blocked by CORS. Ctrl-C stops the server.
website port="8014":
    #!/usr/bin/env bash
    set -euo pipefail
    cd "{{justfile_directory()}}/website"
    python3 -m http.server {{port}} --bind 127.0.0.1 &
    server=$!
    trap 'kill $server 2>/dev/null || true' EXIT
    sleep 1
    open "http://127.0.0.1:{{port}}/"
    wait $server
