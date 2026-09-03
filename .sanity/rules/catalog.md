# Finding rules

The thresholds this repo's findings are found with. Calibrated once, against
this repo, to produce a list somebody would read to the bottom — and then
LEFT ALONE, so that dealing with a finding makes the list shorter instead of
lowering the bar for the next one.

Edit a number and it is used as written. Delete the file and it is
calibrated again.

- `giant-function`; loc >= 339
- `crowded-file`; funcs >= 44
- `load-bearing-unread`; callers >= 20
- `knotty-load-bearing`; callers >= 12
- `load-bearing-illegible`; callers >= 10
- `load-bearing-undocumented`; callers >= 10
- `surprising-changing`; commits >= 4
- `surprising-far-reaching`; calls >= 30
- `stale-doc`; documented >= 0.95
- `trap-being-edited`; commits >= 3
- `fossil-trap`; age >= 1095
- `clone-being-edited`; commits >= 2
- `widely-cloned`; loc >= 30
- `fossil`; loc >= 100
- `tangled-for-size`; loc >= 98
