# Finding rules

What this repo looks for, and how hard. Calibrated once against this repo to
produce a list somebody would read to the bottom — and then LEFT ALONE, so that
dealing with a finding makes the list shorter instead of lowering the bar for
the next one.

Edit a number and it is used as written. Add `; off` to silence a rule. Delete
the file and it is calibrated again. A rule whose id is not one of sanity's own
carries its own title and sentence, because there is nothing to fall back to.

- `giant-function`; func: loc >= 339 and cognitive >= 10
- `crowded-file`; file: funcs >= 46
- `load-bearing-unread`; func: callers >= 20 and read < 1 and loc >= 10
- `knotty-load-bearing`; func: tangle >= 0.8 and callers >= 13 and loc >= 10
- `load-bearing-illegible`; func: illegible >= 0.6 and callers >= 10 and loc >= 10
- `load-bearing-undocumented`; func: documented < 0.35 and callers >= 10 and loc >= 10
- `surprising-changing`; func: surprise >= 0.6 and commits >= 4 and loc >= 10
- `surprising-far-reaching`; func: surprise >= 0.6 and calls >= 31 and loc >= 10
- `stale-doc`; func: documented >= 0.7 and surprise >= 0.9 and loc >= 10
- `trap-being-edited`; func: trap >= 1 and commits >= 3 and loc >= 10
- `fossil-trap`; func: trap >= 1 and age >= 1095 and loc >= 10
- `clone-being-edited`; func: clone_count >= 3 and commits >= 2 and loc >= 10
- `widely-cloned`; func: clone_count >= 4 and loc >= 30
- `fossil`; func: age >= 1825 and loc >= 100
- `tangled-for-size`; func: tangle >= 0.8 and loc >= 98
- `hard-to-follow-and-far-reaching`; func: illegible >= 0.6 and calls >= 25 and loc >= 10; title: Hard to follow, and far-reaching; so what: A reader found it hard going, and it coordinates a lot.; says: A reader got through this and reported it as hard going, and it calls {{calls}} other things. Whoever picks it up has to hold both at once.

