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
- spec 2 · read at `5809d94c635d` · commit `ba429b4` · read by claude-sonnet-4.5 · asked for claude-sonnet-5 · via claude · when 2026-08-13T20:52:04Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: A short, standalone Swift snippet documenting a reproducible bug involving NSOpenPanel's list view mode — likely showing minimal code that triggers the issue (e.g. list view not rendering or crashing) along with a "mode" variable/enum, kept in docs/bugs as a reference case rather than compiled production code. No file header comment since it's a scratch repro, not a maintained source file.
- found: A standalone runnable Swift script that opens an NSOpenPanel (directory picker), reading three NSGlobalDomain UserDefaults keys before and after the modal to check which view mode (icon/list/column) the panel persisted, to help debug/verify whether the user's chosen view mode sticks.
- predicted: most · documented: none · derivable: yes · legible: not judged · trap: no
- note: Correctly guessed the domain (view-mode persistence repro) but didn't anticipate it reads specific UserDefaults keys directly rather than using some enum/mode abstraction.

### `mode` — PREDICTED SOME
- spec 2 · read at `a24c4861041e` · commit `ba429b4` · read by claude-sonnet-5 · via claude · when 2026-08-13T20:46:58Z · by ross@rossturk.com · cold reading · reading 2 of its run · priming: CLAUDE.md excluded
- expected: Reads a key from NSGlobalDomain UserDefaults (the open/save panel's persisted last-used view mode), extracts an integer value, and maps 1/2/3 to "icon"/"list"/"column" strings, with some fallback string for anything else/missing.
- found: Reads NSGlobalDomain's persistent domain and checks three candidate key names for the open panel's last list-view mode setting, returning a string listing each key and its raw value (or \"unset\") joined together — a diagnostic dump rather than a single decoded mode.
- predicted: some · documented: some · derivable: no · legible: full · trap: no
- note: I expected a single key decoded into icon/list/column; actual code probes three differently-named candidate keys and dumps raw values, since which key AppKit actually uses is apparently what's in question.
