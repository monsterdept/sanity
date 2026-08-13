# docs — sanity assessment

1 of 2 read · 1 surprising

Each entry below is one **reading**, of a function or of a whole file. An agent was
given its name, signature, neighbouring names and comments — never its body — and
wrote down what it expected to find. Then it opened the file. The gap between the
two is the finding. A file's own entry is titled `the file itself` and asks whether
the header at the top describes what is actually in there.

`read at` is a hash of the body as it was when the reading was made. When it
stops matching the code, the reading is marked STALE and goes back in the queue.

What this is and how to add to it: [README.md](README.md)

## docs/bugs/OpenPanelListViewRepro.swift

### `mode` — QUIRKY
- spec 2 · read at `a24c4861041e` · commit `3b19ac9` · read by claude-sonnet-5 · via claude · when 2026-08-13T19:35:47Z · by ross@rossturk.com · cold reading · reading 3 of its run · priming: CLAUDE.md excluded
- expected: Reads the persisted NSOpenPanel view-mode preference from NSGlobalDomain (likely via CFPreferencesCopyAppValue or UserDefaults on the global domain, key something like "NSNavPanelFileListModeForOpenMode"), converts the raw integer (1/2/3) into a human-readable string like "icon", "list", or "column", and returns that description for the repro script's printout.
- found: Reads the global UserDefaults domain and dumps the raw values (or "unset") of three candidate preference key names that might hold the persisted NSOpenPanel view mode, joined into one diagnostic string — it doesn't know which key is correct so it prints all three rather than decoding a single value into icon/list/column.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I expected it to decode a known key into a human label, but it's actually hedging across three guessed key names since the doc admits uncertainty about which one AppKit uses.
