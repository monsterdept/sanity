# Decisions

What somebody decided about a finding: that it needs doing, that it is fine as
the code stands, or that it is fine whatever the code does. Each records the
rule that raised it and the state the code was in.

`fine-for-now` expires when that state moves, because "this is fine" was said
about code that no longer exists. `fine-always` does not.

Written by sanity. Editing it by hand is fine; it is parsed back.

## scripts/expiry-check.py#main

- rule `tangled-for-size`; called `Tangled for its size`; verdict `fine-for-now`; pin `23be26c86ff7 tangle=1 loc=98`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: a release gate that reads a diff, its branches are the cases it gates

## src-tauri/src/agentapi.rs

- rule `crowded-file`; called `Crowded file`; verdict `fine-for-now`; pin `c7054aab8ce8 funcs=165`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: the outlier at 165, and worth splitting, ask again when it next changes

## src-tauri/src/agentapi.rs#blank

- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `8f7a2cd373be documented=0 callers=15 loc=32`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: same: real callers, no documentation

## src-tauri/src/agentapi.rs#collect_tasks

- rule `load-bearing-illegible`; called `Load-bearing and hard to read`; verdict `flagged`; pin `b9e31b198893 illegible=0.62 callers=10 loc=203`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: hard to follow, load-bearing and undocumented all at once
- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `b9e31b198893 documented=0 callers=10 loc=203`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: hard to follow, load-bearing and undocumented all at once

## src-tauri/src/assessment.rs

- rule `crowded-file`; called `Crowded file`; verdict `fine-always`; pin `d6af560aab00 funcs=70`; when 2026-09-06T19:29:23Z; by ross@rossturk.com; reason: a module is a file here, the count is the language's unit, not a design decision

## src-tauri/src/assessment.rs#parse_shard

- rule `knotty-load-bearing`; called `Knotty and load-bearing`; verdict `fine-for-now`; pin `9548eb2712b4 tangle=0.8125 callers=13 loc=133`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: parsing markdown back is knotty by nature
- rule `tangled-for-size`; called `Tangled for its size`; verdict `fine-for-now`; pin `9548eb2712b4 tangle=0.8125 loc=133`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: parsing markdown back is knotty by nature

## src-tauri/src/cli.rs

- rule `crowded-file`; called `Crowded file`; verdict `fine-always`; pin `42e8bc891c4c funcs=52`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a module is a file here, the count is the language's unit, not a design decision

## src-tauri/src/commands.rs

- rule `crowded-file`; called `Crowded file`; verdict `fine-always`; pin `a926dd40bea6 funcs=59`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a module is a file here, the count is the language's unit, not a design decision

## src-tauri/src/edges.rs#wire

- rule `tangled-for-size`; called `Tangled for its size`; verdict `fine-for-now`; pin `4109d0b92125 tangle=1 loc=98`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: three passes and tiers, just rewritten, and the tangle is the tiers

## src-tauri/src/findings.rs

- rule `crowded-file`; called `Crowded file`; verdict `fine-always`; pin `519c8069f3a2 funcs=107`; when 2026-09-06T19:29:23Z; by ross@rossturk.com; reason: a module is a file here, the count is the language's unit, not a design decision

## src-tauri/src/findings.rs#rules_for

- rule `trap-being-edited`; called `Trap in code people are editing`; verdict `flagged`; pin `9acd4673b9af trap=1 commits=5 loc=42`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a trap a reader named, in code being edited right now

## src-tauri/src/history.rs

- rule `crowded-file`; called `Crowded file`; verdict `fine-always`; pin `dc1d24ba59fc funcs=84`; when 2026-09-06T19:29:23Z; by ross@rossturk.com; reason: a module is a file here, the count is the language's unit, not a design decision

## src-tauri/src/history.rs#read#2

- rule `knotty-load-bearing`; called `Knotty and load-bearing`; verdict `fine-for-now`; pin `c6ea850b1e39 tangle=1 callers=18 loc=47`; when 2026-09-06T19:29:26Z; by ross@rossturk.com; reason: load-bearing and knotty, and the count is honest now

## src-tauri/src/model.rs#dir

- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `2c65b2f4441a documented=0 callers=23 loc=43`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: load-bearing with a caller count that is now honest, it needs the doc

## src-tauri/src/parse.rs

- rule `crowded-file`; called `Crowded file`; verdict `fine-always`; pin `c5ba95b32a9a funcs=106`; when 2026-09-06T19:29:23Z; by ross@rossturk.com; reason: a module is a file here, the count is the language's unit, not a design decision

## src-tauri/src/parse.rs#walk

- rule `knotty-load-bearing`; called `Knotty and load-bearing`; verdict `fine-for-now`; pin `59d7c259f5bf tangle=1 callers=19 loc=35`; when 2026-09-06T19:29:26Z; by ross@rossturk.com; reason: a cursor walk, knotty because tree-sitter is

## src-tauri/src/scan.rs#scan

- rule `giant-function`; called `Giant function`; verdict `flagged`; pin `ad47ec18fcab loc=476 cognitive=36`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a reader found it hard to follow and 21 call sites depend on it, that pair is the point of the lens
- rule `load-bearing-illegible`; called `Load-bearing and hard to read`; verdict `flagged`; pin `ad47ec18fcab illegible=0.62 callers=21 loc=476`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a reader found it hard to follow and 21 call sites depend on it, that pair is the point of the lens

## web/src/App.tsx#App

- rule `giant-function`; called `Giant function`; verdict `flagged`; pin `f7f6a8de278a loc=3309 cognitive=377`; when 2026-09-06T19:36:39Z; by ross@rossturk.com; reason: 
- rule `surprising-changing`; called `Surprising and changing`; verdict `flagged`; pin `f7f6a8de278a surprise=0.62 commits=13 loc=3309`; when 2026-09-06T19:36:39Z; by ross@rossturk.com; reason: 
- rule `tangled-for-size`; called `Tangled for its size`; verdict `flagged`; pin `f7f6a8de278a tangle=1 loc=3309`; when 2026-09-06T19:36:39Z; by ross@rossturk.com; reason: 

## web/src/components/CodeView.tsx#CodeView

- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; pin `40cb024d8ede loc=368 cognitive=37`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: a viewer, it changes because the panel around it does
- rule `surprising-changing`; called `Surprising and changing`; verdict `fine-for-now`; pin `40cb024d8ede surprise=0.62 commits=7 loc=368`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: a viewer, it changes because the panel around it does

## web/src/components/Detail.tsx#Detail

- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; pin `fac5e0c1fa24 loc=341 cognitive=19`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: the pane's own sections, one after another

## web/src/components/Findings.tsx#Findings

- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; pin `83e24de99bed loc=1038 cognitive=273`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a panel with a form in it, long, and reading top to bottom
- rule `tangled-for-size`; called `Tangled for its size`; verdict `fine-for-now`; pin `83e24de99bed tangle=1 loc=1038`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: a panel with a form in it, long, and reading top to bottom

## web/src/components/HistoryBar.tsx#HistoryBar

- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; pin `104f309657da loc=339 cognitive=29`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: a timeline with a playhead

## web/src/components/LensPane.tsx#Block

- rule `load-bearing-undocumented`; called `Load-bearing and undocumented`; verdict `flagged`; pin `ff23eb13fc40 documented=0 callers=12 loc=41`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: same: real callers, no documentation

## web/src/components/ReadDialog.tsx#ReadDialog

- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; pin `eb943746785a loc=444 cognitive=69`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: a dialog with a budget in it

## web/src/components/SideBar.tsx#SideBar

- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; pin `499663986f73 loc=513 cognitive=25`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: a list of rows with states, length is rows

## web/src/components/Sunburst.tsx#SunburstView

- rule `giant-function`; called `Giant function`; verdict `flagged`; pin `0e0959d9a738 loc=2711 cognitive=347`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: second biggest, same job as App
- rule `tangled-for-size`; called `Tangled for its size`; verdict `flagged`; pin `0e0959d9a738 tangle=1 loc=2711`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: second biggest, same job as App

## web/src/lib/api.ts

- rule `crowded-file`; called `Crowded file`; verdict `fine-always`; pin `259094b05809 funcs=76`; when 2026-09-06T19:29:24Z; by ross@rossturk.com; reason: one function per command on the wire, the count is the API surface, not a pile

## web/src/lib/colorMode.ts#contribute

- rule `tangled-for-size`; called `Tangled for its size`; verdict `fine-for-now`; pin `a1415f9aa893 tangle=1 loc=304`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: bands a value per lens, the branching is the lenses

## web/src/lib/history.ts#frameTree

- rule `giant-function`; called `Giant function`; verdict `fine-for-now`; pin `3dcec30cd73d loc=538 cognitive=112`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: one walk of a frame, and the length is the tree

## web/src/lib/label.ts#fitLabel

- rule `tangled-for-size`; called `Tangled for its size`; verdict `fine-for-now`; pin `b9413b230803 tangle=1 loc=98`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: fitting text to an arc, all of it cases

## web/src/lib/movie.ts#caption

- rule `tangled-for-size`; called `Tangled for its size`; verdict `fine-for-now`; pin `cd1960d08891 tangle=0.8333333 loc=99`; when 2026-09-06T19:29:25Z; by ross@rossturk.com; reason: caption layout, and every branch is a case
