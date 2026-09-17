# Decisions

What somebody decided about a finding: that it needs doing, that it is fine as
the code stands, or that it is fine whatever the code does. Each records the
rule that raised it and the state the code was in.

`fine-for-now` expires when that state moves, because "this is fine" was said
about code that no longer exists. `fine-always` does not.

Written by sanity. Editing it by hand is fine; it is parsed back.

## src-tauri/src/agentapi.rs#blank

- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `8f7a2cd373be documented=0 callers=15 loc=32`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: same: real callers, no documentation

## src-tauri/src/agentapi.rs#collect_tasks

- rule `load-bearing-illegible`; called `Load-bearing and hard to read`; verdict `flagged`; pin `b9e31b198893 illegible=0.62 callers=10 loc=203`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: hard to follow, load-bearing and undocumented all at once
- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `b9e31b198893 documented=0 callers=10 loc=203`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: hard to follow, load-bearing and undocumented all at once

## src-tauri/src/findings.rs#rules_for

- rule `trap-being-edited`; called `Trap in code people are editing`; verdict `flagged`; pin `9acd4673b9af trap=1 commits=5 loc=42`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a trap a reader named, in code being edited right now

## src-tauri/src/model.rs#dir

- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `2c65b2f4441a documented=0 callers=23 loc=43`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: load-bearing with a caller count that is now honest, it needs the doc

## src-tauri/src/scan.rs#scan

- rule `giant-function`; called `Giant function`; verdict `flagged`; pin `ad47ec18fcab loc=476 cognitive=36`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a reader found it hard to follow and 21 call sites depend on it, that pair is the point of the lens
- rule `load-bearing-illegible`; called `Load-bearing and hard to read`; verdict `flagged`; pin `ad47ec18fcab illegible=0.62 callers=21 loc=476`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a reader found it hard to follow and 21 call sites depend on it, that pair is the point of the lens

## web/src/App.tsx#App

- rule `giant-function`; called `Giant function`; verdict `flagged`; pin `f7f6a8de278a loc=3309 cognitive=377`; when 2026-09-06T19:36:39Z; by ross@rossturk.com; reason: 
- rule `surprising-changing`; called `Surprising and changing`; verdict `flagged`; pin `f7f6a8de278a surprise=0.62 commits=13 loc=3309`; when 2026-09-06T19:36:39Z; by ross@rossturk.com; reason: 
- rule `tangled-for-size`; called `Tangled for its size`; verdict `flagged`; pin `f7f6a8de278a tangle=1 loc=3309`; when 2026-09-06T19:36:39Z; by ross@rossturk.com; reason: 

## web/src/components/LensPane.tsx#Block

- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `ff23eb13fc40 documented=0 callers=12 loc=41`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: same: real callers, no documentation

## web/src/components/Sunburst.tsx#SunburstView

- rule `giant-function`; called `Giant function`; verdict `flagged`; pin `0e0959d9a738 loc=2711 cognitive=347`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: second biggest, same job as App
- rule `tangled-for-size`; called `Tangled for its size`; verdict `flagged`; pin `0e0959d9a738 tangle=1 loc=2711`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: second biggest, same job as App
