# docs — sanity assessment

2 of 2 read · 1 unpredicted

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

## docs/bugs/OpenPanelListViewRepro.swift

### the file itself
- spec 3 · read at `5809d94c635d` · commit `9887af2` · read by claude-sonnet-5 · via claude · when 2026-09-25T01:38:40Z · by ross@rossturk.com · cold reading · reading 7 of its run · priming: CLAUDE.md excluded
- expected: A small standalone Swift script reproducing a macOS NSOpenPanel bug where the panel doesn't open in list view; it has a single `mode` variable and sets up an open panel, runs it, and prints the result. No header docs.
- found: Standalone Swift repro: a directories-only NSOpenPanel, with mode() reading the view-mode keys from NSGlobalDomain before and after runModal, then printing response, URLs and directory.
- predicted: most · documented: most · derivable: no · legible: not judged · trap: no
- note: The header comment describes only mode(); it never says what bug the file reproduces or what result counts as the bug.

### `mode` — PREDICTED SOME
- spec 2 · read at `a24c4861041e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:58Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Reads a key from NSGlobalDomain UserDefaults (the open/save panel's persisted last-used view mode), extracts an integer value, and maps 1/2/3 to "icon"/"list"/"column" strings, with some fallback string for anything else/missing.
- found: Reads NSGlobalDomain's persistent domain and checks three candidate key names for the open panel's last list-view mode setting, returning a string listing each key and its raw value (or \"unset\") joined together — a diagnostic dump rather than a single decoded mode.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I expected a single key decoded into icon/list/column; actual code probes three differently-named candidate keys and dumps raw values, since which key AppKit actually uses is apparently what's in question.
