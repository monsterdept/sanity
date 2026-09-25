# What this repo looks for

Every rule that ran on the last scan. A finding is one subject — a function
or a file — that answers every clause of a rule at once.

Generated on every scan. Editing it does nothing; `catalog.md` beside it is
where changes go, and it exists only once this repo has made one.

| Rule | Asks | Says |
|---|---|---|
| **Giant and knotty**<br>`giant-function` | `func: loc >= 200 and tangle >= 0.25 and read < 1` | Long, more complicated than its size usually is, and not read yet. |
| **Giant and hard to follow** *(tuned here)*<br>`giant-illegible` | `func: loc >= 333 and illegible >= 0.6` | Long, and a reader had to work to follow it. |
| **Crowded and unexplained**<br>`crowded-file` | `file: funcs >= 40 and doc_present < 1 and read < 1` | Many functions, no header saying what they are for, and not read yet. |
| **Crowded and hard to navigate**<br>`crowded-unpredictable` | `file: funcs >= 40 and surprise >= 0.6` | Many functions, and a reader could not tell what the file holds. |
| **Load-bearing**<br>`load-bearing-unread` | `func: dependents >= 20 and read < 1 and ncloc >= 10` | Widely depended on, and not read yet. |
| **Knotty and load-bearing**<br>`knotty-load-bearing` | `func: tangle >= 0.8 and dependents >= 10 and ncloc >= 10` | Branches a lot, and widely depended on. |
| **Load-bearing and hard to read**<br>`load-bearing-illegible` | `func: illegible >= 0.6 and dependents >= 10 and ncloc >= 10` | Hard to follow, and widely depended on. |
| **Load-bearing and undocumented**<br>`load-bearing-undocumented` | `func: doc_present < 1 and dependents >= 10 and ncloc >= 10` | Widely depended on, with nothing written about it. |
| **A declaration with nothing but its signature**<br>`undocumented-declaration` | `func: header >= 1 and doc_present < 1 and dependents >= 10 and ncloc < 10` | Widely depended on, and it declares without explaining. |
| **Load-bearing, unpredicted and no test found**<br>`load-bearing-untested` | `func: under_test < 1 and surprise >= 0.6 and dependents >= 10 and ncloc >= 10` | Depended on, unpredictable, and no test was found to reach it. |
| **Unpredicted and changing**<br>`surprising-changing` | `func: surprise >= 0.6 and commits >= 4 and ncloc >= 10` | Changing often, and nobody predicted it. |
| **Unpredicted and far-reaching** *(tuned here)*<br>`surprising-far-reaching` | `func: surprise >= 0.6 and calls >= 18 and ncloc >= 10` | It calls a great deal and nobody predicted it. |
| **Stale doc**<br>`stale-doc` | `func: doc_relevant >= 0.7 and surprise >= 0.9 and ncloc >= 10` | Documented, and a reader still could not predict it. |
| **Trap in code people are editing**<br>`trap-being-edited` | `func: trap >= 1 and commits >= 3 and ncloc >= 10` | Easy to break when edited, and being edited. |
| **Fossil trap**<br>`fossil-trap` | `func: repo_age >= 730 and trap >= 1 and touched >= 1095 and ncloc >= 10` | Easy to break when edited, and years since anyone did. |
| **Clone being edited**<br>`clone-being-edited` | `func: clone_count >= 3 and commits >= 2 and ncloc >= 10` | One copy changed and the others did not. |
| **Widely cloned**<br>`widely-cloned` | `func: clone_count >= 4 and ncloc >= 30` | The same body, in several places. |
| **Fossil**<br>`fossil` | `func: repo_age >= 1095 and touched >= 1825 and ncloc >= 100` | No commit has changed it in years. |
| **Tangled for its size**<br>`tangled-for-size` | `func: tangle >= 0.8 and ncloc >= 40 and read < 1` | More complicated than its length accounts for, and not read yet. |
| **Tangled and hard to follow** *(tuned here)*<br>`tangled-illegible` | `func: tangle >= 0.8 and illegible >= 0.6 and ncloc >= 213` | More complicated than its length accounts for, and a reader had to work to follow it. |
| **Load-bearing, and only one person has been in it**<br>`sole-author` | `func: repo_headcount >= 4 and headcount <= 1 and dependents >= 10 and ncloc >= 10` | Widely depended on, and every line of it was last touched by the same person. |
| **Coordinates a lot, and only one person has been in it**<br>`sole-author-coordinator` | `func: repo_headcount >= 4 and headcount <= 1 and calls >= 10 and ncloc >= 10` | It calls a great deal, and every line of it was last touched by the same person. |
| **Alone in a file others work in**<br>`alone-in-shared-code` | `func: file_headcount >= 6 and headcount <= 1 and ncloc >= 20` | Only one person's lines are in this body, in a file several people work in. |
| **A file nobody else has been in**<br>`lone-file` | `file: repo_headcount >= 6 and funcs >= 5 and headcount <= 2` | A whole file with only one or two people's lines in it, on a project with many. |
| **Many have been in it, and it is knotty**<br>`crowded-and-knotty` | `func: headcount >= 4 and tangle >= 0.8 and ncloc >= 10` | Several people have been in something more complicated than its length accounts for. |
