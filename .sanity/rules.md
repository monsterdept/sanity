# Lead rules

The thresholds this repo's leads are found with. Calibrated once, against
this repo, to produce a list somebody would read to the bottom — and then
LEFT ALONE, so that dealing with a lead makes the list shorter instead of
lowering the bar for the next one.

Edit a number and it is used as written. Delete the file and it is
calibrated again.

- `Giant function`; loc >= 339
- `Crowded file`; funcs >= 44
- `Load-bearing and unread`; callers >= 20
- `Knotty and load-bearing`; callers >= 12
- `Load-bearing and hard to read`; callers >= 10
- `Load-bearing and undocumented`; callers >= 96
- `Hot and busy`; commits >= 4
- `Surprising and far-reaching`; calls >= 30
- `Stale doc`; documented >= 0.95
- `Trap in code people are editing`; commits >= 3
- `Fossil trap`; age >= 1095
- `Clone being edited`; commits >= 2
- `Widely cloned`; loc >= 30
- `Fossil`; loc >= 100
- `Tangled for its size`; loc >= 96
