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

# Run the CLI — `just cli check ../tally --model sonnet`, `just cli status ../tally`.
#
# The sibling of `just dev`. That one opens a window and is the human's to run; this is the
# same binary with no window, which since `sanity check` is how a run actually starts is
# now the more useful half during development.
#
# The path is resolved to an absolute one BEFORE cargo is invoked, for the reason `scan`
# documents: `just` runs recipes from the justfile's directory, so a relative path means
# this repo rather than the one you are standing in — and for a verb that WRITES readings
# into `.sanity/`, quietly picking the wrong repo is worse than for one that only prints.
#
# Verbs that take no repo (`serve`, `help`) ignore the argument, so the default is harmless.
cli verb="help" path="." *flags="":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    cargo run --manifest-path src-tauri/Cargo.toml --quiet --bin sanity -- {{verb}} "$target" {{flags}}

# Type-check + build the frontend only.
web:
    cd web && npm run build

# Fast gate: Rust type-checks + TypeScript type-checks (no bundling, no window).
check:
    cd src-tauri && cargo check
    cd web && npx tsc -b

# Format both halves. The configs beside them are what make this a no-op rather than a
# rewrite — see src-tauri/rustfmt.toml and web/.prettierrc. Run it on its own, never mixed
# into a change somebody has to review.
fmt:
    cd src-tauri && cargo fmt
    cd web && npx prettier --write "src/**/*.{ts,tsx,css}" "scripts/**/*.ts"

# Fail if anything is unformatted — the check half of `fmt`, for CI or a pre-commit look.
fmt-check:
    cd src-tauri && cargo fmt --check
    cd web && npx prettier --check "src/**/*.{ts,tsx,css}" "scripts/**/*.ts"

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
    just replay-check
    just rim-check
    cd src-tauri && cargo test
    cd src-tauri && cargo clippy --all-targets -- -D warnings

# Re-solve the sunburst's ramp hues. `verify` reproduces what ships (and fails if it cannot,
# which is what makes the rest of it worth reading); `add N` asks whether the wheel has room
# for N more lens ramps; `flat` picks a standalone accent for a lens that is not a ramp.
#
# index.css says "Re-solve, don't eyeball" over a search nobody could re-run. This is it.
palette cmd="verify" *args:
    @python3 scripts/palette-search.py {{cmd}} {{args}}

# Does this release expire committed readings? Run it any time; `just release` gates on it.
# Takes an optional ref pair for auditing history — `just expiry 16b3bba~1 16b3bba` is the
# change that made this necessary, and it fails there.
expiry *refs:
    @python3 scripts/expiry-check.py {{refs}}

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

# Replay a repo's history headlessly — `just history ../slooth`. The app is the human's
# to open, so this is how a change to the commit walk gets checked: it prints how many
# commits replayed, how many functions survive to HEAD, and the busiest frames. A rename
# mishandled as an add shows up here as a function count that only ever climbs.
history path="." *flags="":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    cd src-tauri && cargo run --quiet --bin sanity-history -- "$target" {{flags}}

# Fold a synthetic timeline to the same commit two ways and compare the trees field by
# field — the check that a backward seek returns exactly what playback returns.
#
# `replay` is a pure accelerator and checkpoints extend that promise to seeking, which is a
# claim about code no repo on this machine can prove: the timeline is generated, so the run
# is deterministic and needs nothing checked out. It also prints the seek against a fold
# from the opening state, and fails if the two are close — a seek that thawed nothing is
# correct and slow, which no equality check can see.
#
# esbuild rather than a test runner: the frontend has no test framework, and one bundle of
# one file is a smaller thing to keep working than a framework nothing else uses.
replay-check:
    #!/usr/bin/env bash
    set -euo pipefail
    cd web
    out="$(mktemp -d)/replay-check.mjs"
    ./node_modules/.bin/esbuild scripts/replay-check.ts --bundle --format=esm \
        --platform=node --outfile="$out" --log-level=warning
    node "$out"

# What a rim segment is allowed to claim — see `web/scripts/rim-check.ts`.
#
# The two ways a distribution drawn as bands can lie are both invisible on screen: a band
# wider than the value it names, and a band naming something it is not. Both shipped. Bundled
# and run the way `replay-check` is, for the same reason — the frontend has no test framework
# and one bundle of one file is a smaller thing to keep working than one nothing else uses.
rim-check:
    #!/usr/bin/env bash
    set -euo pipefail
    cd web
    out="$(mktemp -d)/rim-check.mjs"
    ./node_modules/.bin/esbuild scripts/rim-check.ts --bundle --format=esm \
        --platform=node --outfile="$out" --log-level=warning
    node "$out"

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

# Clone the monsters repo at `ref` (branch/tag/sha; default main), build the lib, copy the
# bundle to web/src/lib/mascot.js. Vendored rather than depended on: it's a private repo,
# so a plain `npm install` on a fresh checkout (or in CI) can't fetch it. Same recipe as
# tally's and fussy's. The hand-written mascot.d.ts next to it declares only the surface
# we use, so re-check it after a bundle update.
#
# It moved: `lapbar/neo-mascots` is now `monsterdept/monsters`. The old address does not
# fail loudly — it fails as a clone that cannot authenticate, which reads as an SSH problem
# rather than as a repo that is not there any more.
mascot ref="main":
    #!/usr/bin/env bash
    set -euo pipefail
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    git clone --depth=1 --branch {{ref}} git@github.com:monsterdept/monsters.git "$tmp/monsters"
    cd "$tmp/monsters"
    npm install
    npm run build:lib
    cp dist/index.js "{{justfile_directory()}}/web/src/lib/mascot.js"
    # The habitat sheet runs the same creatures in its masthead, so one build feeds
    # both — the app and the site drifting to different mascot versions is the kind
    # of thing nobody notices until the site's crew stops rendering.
    cp dist/index.js "{{justfile_directory()}}/website/assets/mascot.js"
    echo "mascot.js updated from monsters@{{ref}} (app + website)"

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

    # Does this release cost every user a re-read? Decidable from the diff, and the one
    # question about a Sanity release that cannot be answered after the fact — by then the
    # readings have already expired in somebody's repo, and they find out from a coverage
    # number that dropped. Fails only on an UNDECLARED expiry: a hash input moved while
    # every cache and every stored reading still claims to be current. A declared one
    # prints what it costs and proceeds, because improving the metric is the job.
    # Captured, not just printed. The check told the operator and then trusted them to
    # carry it into the note by hand — which is the same shape as an invariant living in a
    # comment, and it failed on the first release that used it: v0.9.0 expires every
    # reading in every repo and its tag says nothing about it.
    expiry=$(python3 scripts/expiry-check.py) || {
        echo "$expiry"
        echo "error: this release expires readings without declaring it — see above" >&2
        exit 1
    }
    echo "$expiry"

    # Annotate the tag with the commit log since the previous tag, so `git show
    # $tag` is useful even though the GitHub release body is generated. The expiry verdict
    # goes FIRST: it is the only line in here that costs the reader an afternoon.
    prev=$(git describe --tags --abbrev=0 2>/dev/null || true)
    if grep -q "output-neutral" <<<"$expiry"; then
        # **A bump that drops caches is not a bump that expires readings, and the note used to
        # say the second over the first.** `PARSE_VERSION` moving means every cache re-parses;
        # a reading only goes stale when the TEXT a reader was handed moves, which identical
        # bytes through an identical parser cannot do. Declared in `PARSE_OUTPUT_STABLE_SINCE`
        # by whoever made the change, checked by the gate against the version being released
        # from, and worded here — nobody reads a release note to be told their corpus is fine,
        # but the one who reads it to find out why their corpus expired deserves the truth.
        warning=$(printf 'Caches drop and every repo re-parses once. NO committed reading expires.')
        warning="$warning"$'\n\n'
    elif grep -q "EXPIRES READINGS" <<<"$expiry"; then
        # **What it costs depends on WHICH version moved, and saying the wrong one is worse
        # than saying nothing.** A parse or hash-input change expires whole readings: they go
        # stale and want re-reading. A SPEC bump does not — it dates one AXIS, so `predicted`
        # and `documented` survive and only the reworded question greys out, refilling on
        # ordinary re-reading. Telling somebody their corpus is stale when a quarter of one
        # column is dated sends them to re-read thousands of functions for nothing.
        declared=$(sed -n 's/^    declared: /  - /p' <<<"$expiry")
        #
        # Written with `\n` rather than as a multi-line string: every line of a recipe has
        # to be indented, so a quoted string whose continuations start at column 0 ends the
        # recipe as far as `just` is concerned, and the next line is parsed as a new item.
        if grep -q "declared: SPEC" <<<"$expiry" && ! grep -qE "declared: (PARSE_VERSION|FORMAT_VERSION)" <<<"$expiry"; then
            cost=$(printf 'Readings are NOT stale and keep their colour. What expires is the axis whose\nquestion changed: those grades are kept and shown as history, but they stop\ncounting until the function is read again. Ordinary re-reading refills them.')
        else
            cost=$(printf 'Every repo assessed with an earlier version will show readings as stale and\nwant re-reading. Run `sanity check <repo>` again after upgrading.')
        fi
        warning=$(printf 'THIS RELEASE EXPIRES COMMITTED READINGS.\n\n%s\n\n%s' "$declared" "$cost")
        # `$( )` eats trailing newlines, so the blank line that separates this from the
        # changelog has to be re-attached rather than printed inside the substitution.
        warning="$warning"$'\n\n'
    else
        warning=""
    fi

    # **A cache bump is a third thing to declare, and it went unsaid on the release that
    # needed it.** v0.18.0 moved `BANK_FORMAT` to bincode, which charges every user a whole
    # `git log` on their next launch; the gate watched only reading inputs, correctly said
    # "expires nothing", and the tag body said nothing at all. Nobody reads a release note to
    # be told their caches are fine, but somebody whose launch got slower deserves to find the
    # answer rather than guess at it — and by the time they look, it has already happened.
    #
    # Orthogonal to the reading verdict rather than another branch of it: a release can expire
    # readings AND rebuild caches, and the two costs are paid by different things.
    recompute=$(sed -n 's/^    recomputes: /  - /p' <<<"$expiry")
    if [[ -n "$recompute" ]]; then
        recompute=$(printf 'This release rebuilds machine-local caches. No committed reading expires; the\nfirst launch after upgrading pays to recompute them, once.\n\n%s' "$recompute")
        recompute="$recompute"$'\n\n'
    fi
    if [[ -n "$prev" ]]; then
        body=$(printf '%s\n\n%s%sChanges since %s:\n\n%s\n' "$tag" "$warning" "$recompute" "$prev" "$(git log --pretty='- %s' "$prev"..HEAD)")
    else
        body=$(printf '%s\n\n%s%s%s\n' "$tag" "$warning" "$recompute" "$(git log --pretty='- %s')")
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

    # And that the app inside says what the filename says. CI stamps the version
    # from the tag into four files before building; nothing downstream checked,
    # and for every release up to 0.8.1 it stamped only ONE of them — so a bundle
    # named 0.8.1 held a binary introducing itself to every MCP client as 0.1.0.
    # The filename is not evidence: it is chosen by the same job whose stamping is
    # in question. Info.plist is what the machine will actually report.
    echo "==> Checking the bundle's own version"
    mnt=$(mktemp -d)
    hdiutil attach "$work/$DMG" -mountpoint "$mnt" -nobrowse -readonly -quiet
    # Detached even if the read fails — a left-behind mount outlives this shell and
    # the next run's `hdiutil attach` inherits the mess.
    app=$(find "$mnt" -maxdepth 1 -name '*.app' | head -1)
    got=$(/usr/libexec/PlistBuddy -c "Print :CFBundleShortVersionString" "$app/Contents/Info.plist" 2>/dev/null || echo "")
    hdiutil detach "$mnt" -quiet || true
    rmdir "$mnt" 2>/dev/null || true
    if [ "$got" != "$VERSION" ]; then
        echo "error: $DMG contains version '$got', expected '$VERSION'" >&2
        echo "    the release build did not stamp the version — do not distribute this" >&2
        exit 1
    fi
    echo "    bundle reports $got"

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
    # The CLI, which is the SAME binary — `sanity` with no arguments opens the window and
    # with a verb is the command line, so there is nothing extra to build or version. Brew
    # symlinks it into its own bin, which is already on PATH.
    #
    # Pointed at the binary inside the bundle rather than at a copy: two copies of one
    # thing is how the app and its CLI drift apart, and `sanity check` spawns readers by
    # `current_exe()`, which resolves the symlink back to the bundle either way.
    #
    # A direct download gets none of this, which is what the app's own "Install `sanity`
    # command" button is for.
    echo '  binary "#{appdir}/Sanity.app/Contents/MacOS/sanity"'
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
    # A regenerated cask may only ADD. The generator is this justfile, so a workstation
    # publishing from a stale checkout writes an OLDER cask over a newer one and the only
    # evidence is a line that stopped being there — which is how 0.11.0 shipped without
    # `binary`, leaving every brew user with the app and no `sanity` on PATH. Nothing
    # downstream could see it: the tap served the right version, the DMG was the right
    # bytes, and the check below reads the version and nothing else.
    #
    # version and sha256 are the two lines that are SUPPOSED to change, so they are the
    # only exemptions. Everything else disappearing means this tree is behind the one that
    # published last — pull, don't force.
    lost=$(git diff --staged -U0 -- Casks/sanity.rb \
        | grep '^-' | grep -v '^---' \
        | grep -vE '^-  (version|sha256) ' || true)
    if [ -n "$lost" ]; then
        echo "error: regenerating the cask would REMOVE lines — this checkout is probably stale" >&2
        echo "$lost" >&2
        echo "    pull sanity and re-run \`just publish $VERSION\`" >&2
        exit 1
    fi
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
