# website — sanity assessment

3 of 3 read · 0 unpredicted

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
- spec 3 · read at `fa7bf81fff78` · commit `97a4c30` · read by claude-sonnet-5 · via claude · when 2026-09-26T18:30:55Z · by ross@rossturk.com · cold reading · reading 1 of its run · priming: CLAUDE.md excluded
- expected: A shell installer script served from the website (curl | sh). Defines say() to print messages and die() to print an error and exit, then detects OS/arch, downloads a release binary, and installs it to a bin directory.
- found: POSIX installer: parses --headless/--version, checks OS/arch (macOS only headless on arm64, Windows refused), resolves latest release via GitHub redirect, downloads either headless tarball (with legacy name fallback) or AppImage into ~/.local/bin, warns about libfuse2 and PATH.
- predicted: most · documented: full · derivable: no · legible: full · trap: no
- note: Header is accurate and explains the non-obvious macOS/Windows behavior; only the legacy 0.33.0 naming fallback is documented solely in an inline comment.

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
