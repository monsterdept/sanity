# Rule changes

What THIS repo has changed about its rules. Everything not listed here runs
as sanity ships it — see `README.md` in this directory for the whole set,
which is regenerated on every scan and not worth editing.

Edit a number and it is used as written. Add `; off` to silence a rule.
Delete a line and that rule goes back to the shipped one. Delete the file
and every rule does.

`was:` records the rule a number was tuned against. When a release changes
which fields a rule asks about, the number no longer answers anything and is
dropped rather than left overriding the new rule.

- `giant-illegible`; func: loc >= 333 and illegible >= 0.6; was: func: loc >= 200 and illegible >= 0.6
- `surprising-far-reaching`; func: surprise >= 0.6 and calls >= 18 and ncloc >= 10; was: func: surprise >= 0.6 and calls >= 10 and ncloc >= 10
- `tangled-illegible`; func: tangle >= 0.8 and illegible >= 0.6 and ncloc >= 213; was: func: tangle >= 0.8 and illegible >= 0.6 and ncloc >= 40
