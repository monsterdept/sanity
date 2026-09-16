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

- `giant-function`; func: loc >= 494 and cognitive >= 10; was: func: loc >= 200 and cognitive >= 10
- `crowded-file`; file: funcs >= 50; was: file: funcs >= 40
- `surprising-far-reaching`; func: surprise >= 0.6 and calls >= 16 and loc >= 10; was: func: surprise >= 0.6 and calls >= 10 and loc >= 10
- `tangled-for-size`; func: tangle >= 0.8 and loc >= 120; was: func: tangle >= 0.8 and loc >= 40
- `hard-to-follow-and-far-reaching`; func: illegible >= 0.6 and calls >= 25 and loc >= 10; title: Hard to follow and far-reaching; so what: A reader found it hard going, and it coordinates a lot.; says: A reader got through this and reported it as hard going, and it calls {{calls}} other things. Whoever picks it up has to hold both at once.
