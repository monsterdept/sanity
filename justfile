# Sanity — task runner. See docs/ARCHITECTURE.md.
#
# Shipping is one step: `just release <version>` validates, tags and pushes, and
# .github/workflows/release.yml does the rest — builds every target, signs and
# notarizes the Mac bundle, checks it, publishes the GitHub release, updates the
# Homebrew cask and redeploys the website on Pages. Downloads are served from
# GitHub Releases; dl.dept.monster is frozen at 0.33.0 for anyone pinned there.
repo := "monsterdept/sanity"

# Bare `just` lists the recipes.
[private]
default:
    @just --list --unsorted

# Everything a fresh checkout needs before `just dev` (once).
#
# **The Tauri CLI is a cargo SUBCOMMAND, and that is what this was missing.** `just dev` is
# `cargo tauri dev`, which lives in `~/.cargo/bin` rather than in `web/node_modules` — the
# npm `@tauri-apps/cli` is deliberately not a dependency here — so a new host ran `just
# setup`, got a complete frontend, and then failed on the one command the recipe exists to
# make work. Same install line as `.github/workflows/release.yml`, which is the other
# fresh-host recipe and the one that must not disagree with this.
#
# Presence rather than version: `cargo install` on a host that already has it is a rebuild
# somebody did not ask for, and a MINUTES-long one from source. `^2` is the major this repo
# is written against; a 2.x already on PATH is one this can use.
#
# **What it deliberately does not do is install anything OS-level.** macOS has WebKit and
# Windows has WebView2; Linux needs `libwebkit2gtk-4.1-dev libgtk-3-dev
# libayatana-appindicator3-dev librsvg2-dev libxdo-dev xdg-utils fakeroot`, which is a
# `sudo apt-get` and not a thing a project recipe gets to run on somebody's machine. The
# release workflow lists them for the same reason.
[group("develop")]
[doc("Install tauri-cli and the web deps — once, on a fresh checkout")]
setup:
    #!/usr/bin/env bash
    set -euo pipefail
    if command -v cargo-tauri >/dev/null 2>&1; then
        echo "tauri-cli: $(cargo tauri --version)"
    else
        echo "installing tauri-cli — this builds from source and takes a few minutes"
        cargo install tauri-cli --version "^2" --locked
    fi
    cd web && npm install

# Tauri dev shell + Vite dev server with hot reload.
# This is the human's to run — it opens a window.
[group("develop")]
[doc("Open the app with hot reload (the human's to run — it opens a window)")]
dev:
    cd src-tauri && cargo tauri dev

alias run := dev

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
[group("develop")]
[doc("Run the sanity CLI on a repo — `just cli check ../tally --model sonnet`")]
cli verb="help" path="." *flags="":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    cargo run --manifest-path src-tauri/Cargo.toml --quiet --bin sanity -- {{verb}} "$target" {{flags}}

[group("develop")]
[doc("Vite dev server in a plain browser — UI only, no Tauri backend")]
web-dev:
    cd web && npm run dev

[group("develop")]
[doc("Type-check and build the frontend only")]
web:
    cd web && npm run build

# The configs beside them are what make this a no-op rather than a rewrite — see
# src-tauri/rustfmt.toml and web/.prettierrc. Run it on its own, never mixed into a change
# somebody has to review.
[group("develop")]
[doc("Format Rust and TypeScript — on its own, never inside a change under review")]
fmt:
    cd src-tauri && cargo fmt
    cd web && npx prettier --write "src/**/*.{ts,tsx,css}" "scripts/**/*.ts"

[group("develop")]
[doc("Fail if anything is unformatted — the check half of `fmt`")]
fmt-check:
    cd src-tauri && cargo fmt --check
    cd web && npx prettier --check "src/**/*.{ts,tsx,css}" "scripts/**/*.ts"

[group("test")]
[doc("Fast gate: Rust and TypeScript type-check, no bundling, no window")]
check:
    cd src-tauri && cargo check --workspace
    cd src-tauri && cargo check --no-default-features
    cd web && npx tsc -b

# Everything CI runs, in CI's order (.github/workflows/ci.yml).
[group("test")]
[doc("Everything CI runs, in CI's order — passing means CI passes")]
test:
    # Frontend first: `npm run build` is `tsc -b && vite build`, so it doubles as the
    # TypeScript type-check gate, and tauri-build reads web/dist while compiling src-tauri.
    cd web && npm run build
    just web-check
    cd src-tauri && cargo test --workspace
    cd src-tauri && cargo clippy --workspace --all-targets -- -D warnings
    # The headless build (no window), so one that stops compiling fails here and not in a release.
    cd src-tauri && cargo clippy --no-default-features --all-targets -- -D warnings

# The frontend's checks — each is `web/scripts/<name>-check.ts`, bundled with esbuild and run
# under node. esbuild rather than a test runner: the frontend has no test framework, and one
# bundle of one file is a smaller thing to keep working than a framework nothing else uses.
# A rule that can be wrong invisibly gets one of these.
#
#   replay    Fold a synthetic timeline to the same commit two ways and compare the trees
#             field by field — a backward seek returns exactly what playback returns.
#             `replay` is a pure accelerator and checkpoints extend that promise to seeking,
#             which is a claim about code no repo on this machine can prove: the timeline is
#             generated, so the run is deterministic and needs nothing checked out. It also
#             prints the seek against a fold from the opening state, and fails if the two are
#             close — a seek that thawed nothing is correct and slow, which no equality check
#             can see.
#   rim       What a rim segment is allowed to claim. The two ways a distribution drawn as
#             bands can lie are both invisible on screen: a band wider than the value it
#             names, and a band naming something it is not. Both shipped.
#   keys      Every shortcut, in every state. A keyboard map is a pile of early returns whose
#             ORDER is the behaviour, and adding one key to it silently cost the lens digits.
#   identity  A node is a new object exactly when it means something new. Every memo under
#             the tree reads identity as "this moved", so a walk that clones what it did not
#             change tells the window the whole repo moved and the window redraws. It comes
#             out pixel for pixel identical, on a period, which is why it has shipped twice.
#   map       What the map's picture is without a window. A report draws the map from its
#             markup, rendered by `mapMarkup` with no page to measure against, so the markup
#             has to stand on its own: a real viewBox, every tagged wedge's geometry beside
#             it, names measured by the measurer it was handed.
#   vector    What the vector PDF writer has to get right. Draws a page through every part of
#             the surface and the SVG translator and asks poppler about the file: that it
#             opens, that its fonts are embedded subsets, that its text can be found.
#   group     How a report groups its findings by place.
#
# harfbuzzjs stays external and every bundle sits under `node_modules`, because its wasm is
# found beside its own module rather than beside the bundle; checks that never import it are
# unaffected by either.
[group("test")]
[doc("Frontend checks: replay rim keys identity map vector group — all, or the one named")]
web-check name="":
    #!/usr/bin/env bash
    set -euo pipefail
    cd web
    all="replay rim keys identity map vector group"
    names="{{name}}"
    names="${names:-$all}"
    mkdir -p node_modules/.cache
    for n in $names; do
        if [ ! -f "scripts/$n-check.ts" ]; then
            echo "no check named '$n' — one of: $all" >&2
            exit 1
        fi
        echo "==> $n"
        out="node_modules/.cache/$n-check.mjs"
        ./node_modules/.bin/esbuild "scripts/$n-check.ts" --bundle --format=esm \
            --platform=node --external:harfbuzzjs --loader:.css=empty \
            --outfile="$out" --log-level=warning
        node "$out"
    done

# Takes an optional ref pair for auditing history — `just expiry 16b3bba~1 16b3bba` is the
# change that made this necessary, and it fails there.
[group("test")]
[doc("Does this release expire committed readings? `just release` gates on it")]
expiry *refs:
    @python3 scripts/expiry-check.py {{refs}}

# The app is the human's to open, so this is how a change to the commit walk gets checked: it
# prints how many commits replayed, how many functions survive to HEAD, and the busiest frames.
# A rename mishandled as an add shows up here as a function count that only ever climbs.
[group("headless")]
[doc("Replay a repo's git history without a window — `just history ../slooth`")]
history path="." *flags="":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    cd src-tauri && cargo run --quiet -p sanity-tools --bin sanity-history -- "$target" {{flags}}

# `just findings . --rule "func: loc >= 200 and callers >= 20"`.
#
# The bench the default catalog is tuned on. Read `docs/notes/findings.md` first: the two
# numbers that matter are the calibrated threshold (a count, never a percentile) and the
# marginal contribution (what this rule finds that no other rule already did).
# `[positional-arguments]` so a rule keeps its spaces: `{{flags}}` is raw interpolation and
# splits `--rule "func: loc >= 200"` into five words, which the binary then reads as five
# paths. Every other recipe here takes flags that are single words and never noticed.
[positional-arguments]
[group("headless")]
[doc("A repo's findings without a window — `just findings ../ceph [--rule \"…\"]`")]
findings path="." *flags="":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "$1" && pwd)"
    shift
    cd src-tauri && cargo run --quiet -p sanity-tools --bin sanity-findings -- "$target" "$@"

# Exports the repo's data with the CLI, then draws the PDFs from it; see
# `web/scripts/render.ts`. `--out <dir>` says where they go (default: the current directory).
[group("headless")]
[doc("Render a repo's report/brief/deck PDFs — `just render ../tally all [--out dir]`")]
render repo *flags:
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{repo}}" && pwd)"
    data="$(mktemp -d)/export.json"
    cargo run --manifest-path src-tauri/Cargo.toml --quiet --bin sanity -- export-data "$target" --out "$data"
    here="$(pwd)"
    cd web
    mkdir -p node_modules/.cache
    ./node_modules/.bin/esbuild scripts/render.ts --bundle --format=esm --jsx=automatic \
        --platform=node --external:harfbuzzjs --loader:.css=empty --loader:.wasm=empty \
        --outfile=node_modules/.cache/render.mjs --log-level=warning
    cd "$here"
    SANITY_WEB="$here/web" node web/node_modules/.cache/render.mjs --data "$data" {{flags}}

# The tool descriptions, the subagent prompt, and the task payload for a real repo. At one
# function per reader the fixed prefix is paid once per FUNCTION, so a long `inputSchema`
# description is a per-reading charge. Run it before and after shortening one; guessing is
# how the descriptions got long in the first place.
[group("headless")]
[doc("What a reader pays in tokens — run before and after editing tool descriptions")]
tokens path=".":
    #!/usr/bin/env bash
    set -euo pipefail
    target="$(cd "{{path}}" && pwd)"
    cd src-tauri && cargo run --quiet -p sanity-tools --bin sanity-tokens -- "$target"

[group("ship")]
[doc("Full release bundle, locally (needs the icon set — `just icons` first)")]
build:
    cd web && npm run build
    cd src-tauri && cargo tauri build

[group("ship")]
[doc("Generate every platform's icon from one source PNG")]
icons source="icons/source.png":
    cd src-tauri && cargo tauri icon {{source}}
    just icons-mac {{source}}

# The macOS icon, on Apple's grid rather than full-bleed. Run by `icons`.
#
# **The Dock draws every icon the same size, so a margin is part of the artwork.** Apple's grid
# puts the rounded square at 824 of 1024 with transparent space round it for the shadow, and
# Finder, Mail and Safari all follow it. `cargo tauri icon` scales the source edge to edge, which
# drew this app about a fifth larger than everything beside it in the Dock. The margin is added
# here and only for `.icns`: the Windows and Linux icons stay full-bleed, because those
# platforms do not use the grid and the margin would make them look small.
[private]
icons-mac source="icons/source.png":
    #!/usr/bin/env bash
    set -euo pipefail
    cd src-tauri
    work="$(mktemp -d)"
    set="$work/icon.iconset"
    mkdir "$set"
    magick -size 1024x1024 xc:none \( "{{source}}" -resize 824x824 \) -geometry +100+100 -composite "$work/grid.png"
    # A soft shadow under the square, inside the margin — the Dock's other icons carry one.
    # Built on the same 1024 canvas and composited, never merged and re-centred: `-shadow` grows
    # the canvas by its offset, and centring that back to 1024 lifted the square 8px off the grid.
    magick "$work/grid.png" \( +clone -alpha extract -blur 0x10 -background black -alpha shape \
        -channel A -evaluate multiply 0.3 +channel -roll +0+8 \) +swap -compose over -composite \
        "$work/padded.png"
    for s in 16 32 128 256 512; do
        sips -z "$s" "$s" "$work/padded.png" --out "$set/icon_${s}x${s}.png" >/dev/null
        sips -z $((s * 2)) $((s * 2)) "$work/padded.png" --out "$set/icon_${s}x${s}@2x.png" >/dev/null
    done
    iconutil -c icns "$set" -o icons/icon.icns
    echo "icons/icon.icns written on the macOS grid"

# Validates, tags, pushes; CI builds, signs and attaches the bundles. -suffix = prerelease.
[group("ship")]
[doc("Tag and push a release — `just release 0.1.0`; CI builds it")]
release version:
    #!/usr/bin/env bash
    # Validates, tags v<version> with a changelog body, and pushes the tag → CI
    # (.github/workflows/release.yml) builds every target, signs/notarizes the Mac
    # bundle, publishes the GitHub release, and updates the cask and the website. The
    # tag is the source of truth — CI stamps the bundle version from it (no committed
    # version bump).
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
        echo "==> $tag is a prerelease — it builds and publishes as one, and moves neither the cask nor the site"
    fi

    echo "==> tagging $tag"
    echo "$body" | sed 's/^/    /'; echo
    git tag -a "$tag" -m "$body"
    git push origin "$tag"
    echo "==> pushed. CI: https://github.com/{{repo}}/actions/workflows/release.yml"

# Serve website/ locally and open it. The habitat sheet is plain static files, but it
# must be served rather than opened as file:// — its fonts are fetched with CORS, and a
# font fetched from file:// is blocked. Ctrl-C stops the server.
[group("ship")]
[doc("Preview website/ locally in a browser — `just website [port]`")]
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

# Drop the release half of target/. Releases are built in CI, so a local one is a copy of
# something a tag already made; debug is left alone because `just dev` is the loop that
# would have to pay for it. `cargo clean` if you want the other 25G too.
[group("ship")]
[doc("Delete the local release build; debug builds stay")]
clean:
    rm -rf src-tauri/target/release
    du -sh src-tauri/target
