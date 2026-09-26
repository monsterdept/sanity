# The lenses

Each lens colors the map by one measurement. **Needs** is the step that has to have run
first: Scan (parse the repo), Trace (read its git history) or Read (take readings). They're the
three buttons on each project in the app's sidebar. The descriptions come from the app's
own help.

| Lens | Needs | What it measures | Values |
|---|---|---|---|
| **Complexity** | Scan | How tangled a body is: every fork costs one, plus one for each fork it's nested inside, weighted against other bodies its size in this repo. | low · moderate · high · very high |
| **Composition** | Scan | What the repo is made of: code written here, headers, tests, generated code and vendored code. | code · header · test · generated · vendored |
| **Language** | Scan | The file's language, by extension. | |
| **Clones** | Scan | Functions whose bodies are identical once identifiers and literals are flattened and comments dropped. | too small to compare · no clone in this repo · a clone |
| **Callers** | Scan, in a language whose calls Sanity reads | How many places elsewhere in the repo call the body. Calls from outside the repo aren't counted. | no in-repo caller · 1 · 2–5 · 6+ |
| **Reach** | Scan, in a language whose calls Sanity reads | How many functions defined elsewhere in the repo the body calls. | none · 1 · 2–5 · 6+ |
| **Blame** | Trace | Who last touched the lines: the newest line's author, or whoever holds most of the lines. Not authorship. | newest line · most lines |
| **Age** | Trace | Days since the newest line was written, or, on the other setting, since the oldest line was. | older · this quarter · this month · this week · today |
| **Churn** | Trace | For a function, how many distinct commits its current lines come from. For a file, how many commits in the last 90 days. | no commits found · 1–2 · 3–9 · 10+ |
| **Predictability** | Read | How much of the body the reader predicted from its surroundings, before it was allowed to read the body. | full · most · some · none |
| **Legibility** | Read | What reading the body was like: understood in one pass, in several, or not at all. Independent of Predictability. | full · most · some · none |
| **Docs** | Read | How little of the body its documentation covers. Documentation a model could reproduce from the body alone is graded `none`. | full · most · some · none |
| **Traps** | Read | Whether a reader flagged something likely to catch out the next person who edits the code. | unread · no trap reported · trap |
