# What this repo looks for

Every rule that ran on the last scan. A finding is one subject — a function
or a file — that answers every clause of a rule at once.

Generated on every scan. Editing it does nothing; `catalog.md` beside it is
where changes go, and it exists only once this repo has made one.

| Rule | Asks | Says |
|---|---|---|
| **Giant function** *(tuned here)*<br>`giant-function` | `func: loc >= 339 and cognitive >= 10` | Unusually long, and not just a lot of data. |
| **Crowded file** *(tuned here)*<br>`crowded-file` | `file: funcs >= 46` | Unusually many functions in one file. |
| **Load-bearing and unread**<br>`load-bearing-unread` | `func: dependents >= 20 and read < 1 and loc >= 10` | Read this one next. |
| **Knotty and load-bearing**<br>`knotty-load-bearing` | `func: tangle >= 0.8 and dependents >= 10 and loc >= 10` | Branches a lot, and widely depended on. |
| **Load-bearing and hard to read**<br>`load-bearing-illegible` | `func: illegible >= 0.6 and dependents >= 10 and loc >= 10` | Hard to follow, and widely depended on. |
| **Load-bearing and undocumented**<br>`load-bearing-undocumented` | `func: doc_present < 1 and dependents >= 10 and loc >= 10` | Widely depended on, with nothing written about it. |
| **A declaration with nothing but its signature**<br>`undocumented-declaration` | `func: header >= 1 and doc_present < 1 and dependents >= 10 and loc < 10` | Widely depended on, and it declares without explaining. |
| **Load-bearing, surprising, and no test found**<br>`load-bearing-untested` | `func: under_test < 1 and surprise >= 0.6 and dependents >= 10 and loc >= 10` | Depended on, unpredictable, and no test was found to reach it. |
| **Surprising and changing** *(tuned here)*<br>`surprising-changing` | `func: surprise >= 0.6 and commits >= 7 and loc >= 10` | Changing often, and nobody predicted it. |
| **Surprising and far-reaching** *(tuned here)*<br>`surprising-far-reaching` | `func: surprise >= 0.6 and calls >= 31 and loc >= 10` | It calls a great deal and nobody predicted it. |
| **Stale doc**<br>`stale-doc` | `func: doc_relevant >= 0.7 and surprise >= 0.9 and loc >= 10` | Documented, and a reader still could not predict it. |
| **Trap in code people are editing**<br>`trap-being-edited` | `func: trap >= 1 and commits >= 3 and loc >= 10` | Easy to break when edited, and being edited. |
| **Fossil trap**<br>`fossil-trap` | `func: repo_age >= 730 and trap >= 1 and touched >= 1095 and loc >= 10` | Easy to break when edited, and years since anyone did. |
| **Clone being edited**<br>`clone-being-edited` | `func: clone_count >= 3 and commits >= 2 and loc >= 10` | One copy changed and the others did not. |
| **Widely cloned**<br>`widely-cloned` | `func: clone_count >= 4 and loc >= 30` | The same body, in several places. |
| **Fossil**<br>`fossil` | `func: repo_age >= 1095 and touched >= 1825 and loc >= 100` | No commit has changed it in years. |
| **Tangled for its size** *(tuned here)*<br>`tangled-for-size` | `func: tangle >= 0.8 and loc >= 98` | More complicated than its length accounts for. |
| **Load-bearing, and only one person has been in it**<br>`sole-author` | `func: repo_headcount >= 4 and headcount <= 1 and dependents >= 10 and loc >= 10` | Widely depended on, and every line of it was last touched by the same person. |
| **Coordinates a lot, and only one person has been in it**<br>`sole-author-coordinator` | `func: repo_headcount >= 4 and headcount <= 1 and calls >= 10 and loc >= 10` | It calls a great deal, and every line of it was last touched by the same person. |
| **Alone in a file others work in**<br>`alone-in-shared-code` | `func: file_headcount >= 6 and headcount <= 1 and loc >= 20` | Only one person's lines are in this body, in a file several people work in. |
| **A file nobody else has been in**<br>`lone-file` | `file: repo_headcount >= 6 and funcs >= 5 and headcount <= 2` | A whole file with only one or two people's lines in it, on a project with many. |
| **Many have been in it, and it is knotty**<br>`crowded-and-knotty` | `func: headcount >= 4 and tangle >= 0.8 and loc >= 10` | Several people have been in something more complicated than its length accounts for. |
| **Hard to follow, and far-reaching** *(yours)*<br>`hard-to-follow-and-far-reaching` | `func: illegible >= 0.6 and calls >= 25 and loc >= 10` | A reader found it hard going, and it coordinates a lot. |
