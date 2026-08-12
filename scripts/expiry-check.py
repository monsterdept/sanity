#!/usr/bin/env python3
"""Does this release expire committed readings? Answer it from the diff, not from memory.

`.sanity/` holds readings keyed to the code they were taken against, so some releases cost
every user a re-read and most cost nothing. Which one you are shipping is decidable — it
depends on whether the inputs to `reading_hash` moved, whether the parser moved, and whether
the question readers were asked moved — and deciding it by remembering is how it goes wrong.
It went wrong once already, in the direction this exists to catch: `file_doc` was added to a
cached record with no version bump, and for months readers were handed no file header while
everything downstream believed they had one.

Three outcomes, and the failing one is the interesting one:

  EXPIRES NOTHING   no watched function changed, no version moved. Ship it.
  EXPIRES READINGS  a version moved deliberately. Prints what it costs so the release note
                    can say so out loud. Not an error — this is how a metric improves.
  UNDECLARED        a watched function changed and no version moved. THAT is the bug: the
                    hash inputs shifted while every cache and every stored reading still
                    claims to be current, and nothing anywhere will say so.

Watched functions are compared by their own source text, extracted by name, rather than by
whether their FILE changed — `parse.rs` and `assessment.rs` change constantly for unrelated
reasons, and a gate that cries wolf on every release is one people learn to skip, which is
the same failure as a warning that fires unconditionally.

Usage: expiry-check.py [<previous-ref> [<later-ref>]]   (defaults: most recent tag, HEAD)
Exit 0 when the release is declared, 1 when it is not.

The second ref is for auditing history rather than for releasing: pointing it at an old pair
is how this was checked against the change that made it necessary.
"""

import re
import subprocess
import sys

# Functions whose text decides what a reading was taken against. Changing any of them means
# the same code now hashes differently, so every committed reading in every repo expires.
# Top-level `fn` in every case, which is what makes extraction by name exact.
WATCHED = {
    "src-tauri/src/assessment.rs": ["reading_hash", "body_hash"],
    # `file_doc` and `leading_doc` are the doc stack a reader is handed; `body_span` and
    # `header_end` decide where a body starts and stops.
    "src-tauri/src/parse.rs": ["file_doc", "leading_doc", "body_span", "header_end"],
    # What a FILE reading is hashed over — its signatures, in order.
    "src-tauri/src/scan.rs": ["file_surface"],
}

# The declarations that say "I know this expires something". A watched change is only a bug
# when none of these moved.
VERSIONS = {
    "src-tauri/src/parse.rs": "PARSE_VERSION",
    "src-tauri/src/assessment.rs": "SPEC",
}


def at(ref, path):
    """A file's text at a ref, or None if it did not exist there."""
    try:
        return subprocess.run(
            ["git", "show", f"{ref}:{path}"],
            capture_output=True, text=True, check=True,
        ).stdout
    except subprocess.CalledProcessError:
        return None


def function_text(src, name):
    """One top-level `fn name` with its body, or None.

    Rust closes a module-level item with `}` in column zero, which is what makes this exact
    rather than a brace count that a string literal can fool.
    """
    if src is None:
        return None
    start = re.search(rf"^(?:pub(?:\([^)]*\))? )?fn {re.escape(name)}\b", src, re.M)
    if not start:
        return None
    rest = src[start.start():]
    end = re.search(r"^\}", rest[1:], re.M)
    return rest[: end.end() + 1] if end else rest


def version_of(src, name):
    """The integer a `const NAME: u32 = N;` is set to. Absent is 0 — see `SPEC`."""
    if src is None:
        return 0
    m = re.search(rf"const {re.escape(name)}: u32 = (\d+)", src)
    return int(m.group(1)) if m else 0


def main():
    prev = sys.argv[1] if len(sys.argv) > 1 else None
    later = sys.argv[2] if len(sys.argv) > 2 else "HEAD"
    if not prev:
        prev = subprocess.run(
            ["git", "describe", "--tags", "--abbrev=0"],
            capture_output=True, text=True,
        ).stdout.strip()
    if not prev:
        print("no previous tag — nothing to compare against, so nothing to declare")
        return 0

    changed = []
    for path, names in WATCHED.items():
        before, after = at(prev, path), at(later, path)
        for name in names:
            if function_text(before, name) != function_text(after, name):
                changed.append(f"{path.split('/')[-1]}::{name}")

    moved = []
    for path, const in VERSIONS.items():
        was, now = version_of(at(prev, path), const), version_of(at(later, path), const)
        if was != now:
            moved.append(f"{const} {was} → {now}")

    print(f"==> reading expiry, {prev}..{later}")
    if not changed and not moved:
        print("    EXPIRES NOTHING — no hash input moved, no version moved.")
        return 0

    for c in changed:
        print(f"    changed: {c}")
    for m in moved:
        print(f"    declared: {m}")

    if changed and not moved:
        # The failure this file exists for. Everything still claims to be current.
        print()
        print("    UNDECLARED EXPIRY. A watched function changed and no version moved, so")
        print("    every cache and every committed reading still reports itself as current")
        print("    while being hashed against something else. Bump PARSE_VERSION (a parse")
        print("    or doc-stack change) or SPEC (a change to what readers were asked), or")
        print("    convince yourself the change cannot alter output and say why here.")
        return 1

    print()
    print("    EXPIRES READINGS. This is a normal outcome and a deliberate one — but the")
    print("    release note has to say so, and say roughly what it costs: which repos,")
    print("    and whether it is whole files or only the ones holding a given extension.")
    print("    Users re-read; they should not discover that from a coverage number.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
