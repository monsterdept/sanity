# website — sanity assessment

5 of 5 read · 0 unpredicted

Each entry below is one **reading**, of a function or of a whole file. An
agent was given its name, signature, neighboring names and comments — never
its body — and wrote down what it expected to find. Then it opened the file.
The gap between the two is the finding. A file's own entry is titled `the file
itself` and asks whether the header at the top describes what is actually in
there.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the
queue.

What this is and how to add to it: [README.md](README.md)

## website/install.sh

### the file itself
- spec 3 · read at `fb9d6b081b0f` · commit `3cd02b8` · read by claude-sonnet-5 · via claude · when 2026-09-26T18:46:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A curl-pipe-sh installer served from the website. Defines helpers say (print message), die (print error and exit), sha256 (portable checksum via shasum/sha256sum), and check (verify a download against an expected hash). The main body detects OS/arch, downloads a release binary, verifies its checksum, and installs it into a bin directory. No header docs.
- found: Installer script: parses --headless/--version, checks OS/arch (Linux AppImage or headless tarball; macOS arm64 headless only), resolves the latest release via redirect, downloads SHA256SUMS, verifies the asset checksum before install, moves the binary into ~/.local/bin, and prints libfuse2/PATH hints.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The header covers usage and platform behaviour well, but the AppImage naming quirks and the 0.33.0 asset-name fallback appear only in inline comments.

### `say`
- spec 3 · read at `f67e0551eb4b` · commit `97a4c30` · read by claude-sonnet-5 · via claude · when 2026-09-26T18:30:54Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: One-line shell helper that prints its arguments to stdout, probably with a prefix like "==>" or via printf '%s\n' "$*". Sibling die likely calls say to stderr then exits 1.
- found: Prints its arguments joined as one line to stderr via printf.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no · test: no

### `die`
- spec 3 · read at `a1ad96c09d14` · commit `97a4c30` · read by claude-sonnet-5 · via claude · when 2026-09-26T18:30:53Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: One-line shell function that prints an error message (likely to stderr, perhaps via say or with an "error:" prefix) and exits with non-zero status.
- found: Calls say with "sanity install: " prefixed message, then exits 1.
- predicted: full · documented: none · derivable: yes · legible: full · trap: no · test: no

### `sha256`
- spec 3 · read at `9ff3f2cc8f83` · commit `3cd02b8` · read by claude-sonnet-5 · via claude · when 2026-09-26T18:46:12Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Shell function that checks whether sha256sum exists and, if so, runs it on $1 and prints only the hash field; otherwise falls back to shasum -a 256 (macOS), possibly openssl dgst. Prints the hex digest to stdout.
- found: Prints SHA-256 hex of $1 using sha256sum, else shasum -a 256, else dies with an error message. No openssl fallback.
- predicted: most · documented: none · derivable: yes · legible: full · trap: no · test: no

### `check` — TRAP
- spec 3 · read at `092ed5c53a08` · commit `3cd02b8` · read by claude-sonnet-5 · via claude · when 2026-09-26T18:46:13Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: Takes a file path, looks up its expected hash in the SHA256SUMS file by basename, computes the file's sha256 via the sha256 helper, and dies if the asset isn't listed or the hashes differ.
- found: Takes $1 = file path and $2 = asset name; looks up the hash for that name in $tmp/SHA256SUMS via awk, dies if unlisted, computes sha256 of the file, dies on mismatch.
- predicted: most · documented: none · derivable: yes · legible: full · trap: yes · test: no
- note: It reads the global $tmp and takes two positional args (path, listed name) with no signature or comment saying so; calling it before $tmp holds SHA256SUMS, or with the wrong name, fails the check.
