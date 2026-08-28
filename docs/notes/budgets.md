# Scan, trace, read: work against a budget

## Three processes, one rule: estimated work against a budget

**Scan, trace, read.** A scan parses files and draws the map. A trace reads git. A read puts
agents over the code. They cost three wildly different amounts, and what decides whether one
runs unasked is the estimated WORK, never the size of the repo.

- **Reading git is not part of a scan any more, and on a large repo it was nearly all of it.**
  Cold ceph: 214s, of which `git blame` was **206s** and the log walk 4.4s, against **1.97s**
  of tree-sitter. Taking both out took a cold kibana — 59,008 files, the repo that made this
  necessary — to **9.3s**, and linux to 23s. `trace.rs` owns everything that reads git.
- **Depth 2 is RESOLUTION, not the axis.** `score_dir` has always given a function its own
  history where blame could read it and its file's otherwise. So depth 1 (the log walk) is an
  honest map with blocky rings, and **"not traced yet" is a third state** beside "traced" and
  "this folder has no git history" — the lens says which, and the two absences must never
  render alike.
- **One rule, three answers, and no clause anywhere about repo size or about "the first
  time".** `trace::go` estimates and compares against `BUDGET` (10s): sanity's walk is 0.02s
  and never asks, ceph's is 6.5s and never asks, linux's is 56s and asks once. A "first trace
  always asks" rule is a size test wearing a hat; it does not exist.
- **Pricing is free, and it is two tiers.** A repo walked here knows its own measured
  seconds-per-commit — the spread is fourfold, 40µs on ceph against 160µs on kibana, because
  cost is commits × paths-touched. One nobody has walked is bounded by `git count-objects`
  (0.01s) over a corpus ratio of ten objects to the commit. That classified all five test
  repos correctly at a 10s budget. **`git rev-list --count HEAD` is NOT the pricing tool**: 7.1s
  on linux, which is most of the job you are deciding whether to do.
- **The walk is banked and extended, never rewalked.** `churn::refresh` absorbs
  `<banked>..HEAD` and recounts only the churn window, which is bounded by ninety days of
  activity rather than by the age of the repo. `credit` compares timestamps instead of trusting
  git's newest-first order, which is what makes a delta foldable into a stored walk at all, and
  `a_refreshed_walk_matches_a_whole_one` is the test that keeps it honest. A rewritten history
  is walked again, on the same `merge-base --is-ancestor` test `history.rs` uses.
  **And a second launch over an unchanged repo walks NOTHING.** The churn window is a rate over
  ninety days, so it slides with the clock, and the walk that re-derives it ran on every open:
  2.1s over 5,599 commits on kibana, 12.4s over 28,593 on nixpkgs, before serializing the result
  back over the 142MB it was read from. With HEAD unchanged no commit has come IN — only a few
  age out — so a bank stamped inside `WINDOW_DRIFT` (6h) is handed back and `refresh` reports
  `changed: false` so the caller does not rewrite it. `taken_at` is an `Option` and deliberately
  does NOT move `BANK_FORMAT`: absence reads as "unknown" and walks, which is what every launch
  already did. That is the SAFE half of the `#[serde(default)]` hazard — the rule exists because
  a default can read as a valid value and be believed, and a missing timestamp cannot.
  **The bank is bincode, and that DOES move the format.** 142MB to 84MB, encode 3.66s to 0.36s
  in a debug build. A refused bank is rewalked whole — 90s and 690,536 commits on nixpkgs, once
  — rather than adopted: an adoption path was written, was genuinely safe (same `Bank`, two
  serializers, nothing re-keyed), and was removed anyway, because a second reader has to be kept
  correct forever to save one launch. Bump deliberately; the next one costs the same.
- **Three lists feed the sidebar, and one project is one row.** Loaded, declined for cost
  (`awaiting`), and pending a scan (`restoring`) — any two of them naming a key put that repo on
  screen twice under one name, which is what pressing `Scan` on a declined kibana did: the
  pending row appeared beside the declined one. `scan_repo` clears the declined entry when the
  scan starts, and the summary filters against both lists behind it.
  The test for this passed at first WITHOUT the fix, and that is the part worth remembering: a
  declined row is built from the index, so a fixture that never called `remember` had no
  declined row to duplicate and asserted against a list the bug could not reach. **Check that a
  regression test fails without the fix** — this one now does.
- **`persist` rebuilds every live entry, so a field it forgets is a field that gets erased.**
  The index holds several things memory does not — which agent reads a repo, what its last scan
  cost, how deep it has been traced — and `AppState` knows none of them. A fresh record built
  from the live project wipes them on the next touch of ANY project. This was written down for
  `harness` and happened anyway to `scan_ms` and `trace_depth`: trace a repo, restart, it comes
  back traced; trace a SECOND repo, restart, and both are untraced, because touching the second
  rewrote the first one's record on the way past. A comment is not a field list, so
  `a_touch_cannot_erase_what_only_the_index_knows` asserts every one of them.
- **`sameProjects` is the same rule one process over: a field IT forgets is a number frozen on
  screen.** The 1.5s poll allocates fresh rows every tick, so the list is compared before it is
  stored or a replay re-renders several thousand arcs on a fixed period. It was a hand-written
  conjunction and it has now been wrong three times the same way — twice recorded in its own
  comments, then for the whole trace at once: `tracing_history`, `trace_depth`, `trace_cost`,
  `resolved`, `resolvable`, `behind` and `scan_cost` were all absent, so a running trace fetched
  a fresh counter every tick, the comparator said "same", and the row showed the estimate it had
  been offered before anybody pressed anything. The pill stayed pressed for the same reason: it
  clears on the project object changing, and the object never changed.
  So it is **not a list of fields.** It walks whatever keys the row HAS and compares each one;
  only what needs more than `Object.is` is named, in `DEEPLY`. A field added to `ProjectSummary`
  and forgotten is now compared by default — at worst one extra render — where before it froze.
  **An exceptions list only works if the exceptions are all there**: `events` is a freshly
  allocated array, never `Object.is`-equal to itself, and left out it would mark the list changed
  on every tick forever, which is the periodic stutter from the other direction.
- **An estimate prices what is LEFT, never the work in principle.** Made twice, one phase
  apart. A scan of a repo whose tree is cached is a decode and not a parse — kibana asked to be
  scanned at every launch on a fifteen-second estimate for a tenth of a second of decoding — so
  the gate asks `treecache::warm` before it declines, and pays a walk for the question only when
  the price already said no. A per-line trace of a repo whose blame is cached is a lookup and
  not a `git blame` apiece, which is `trace::relines`. Neither is priced by counting what the
  repo holds; both are priced by counting what is missing.
- **A depth is bought once.** A restore scans without git and reads what the budget allows,
  which is depth 1 — and the per-line pass is nobody's automatic, so a repo somebody had traced
  to the line came back after a restart asking to be traced again. `KnownProject::trace_depth`
  banks what was reached and `trace::relines` decides whether it can be restored **for nothing**:
  blame is cached per file, keyed on content and last-touching commit, so an unchanged repo
  already holds every answer and the only cost is the REMAINDER. A couple of edited files cost a
  blame apiece; a dropped cache asks, because a full pass at launch is the thing the budget
  exists to refuse. A stopped pass banks the depth it reached, never the one it was aiming at.
- **An explicit ask is permission; a timer is not.** `sanity_open`, the window's Open, `sanity
  trace` and the row's Trace button all do what they were told. A launch restoring every
  project and the 1.5s watcher take the budget — those are the least invited work in the app,
  and a branch switch on linux must not start a minute of `git log`.
  Depth 2 is nobody's automatic: it is per-file work at a scale nothing can predict, and
  **a rate cannot be sampled** — thirty files gave 2ms against ceph's measured 34ms.
- **Applying a trace is a second fold, on the pattern readings already follow.** `trace::apply`
  fills the git fields on a finished tree, re-aggregates and re-credits the containers. It is
  idempotent, and `FileTrace` is the ONE definition both the scan and the deferred path use —
  `a_deferred_trace_lands_exactly_where_an_inline_one_did` compares every git-derived field on
  every node. It caught the bug it exists for on its first run: `treecache::signature` could
  not tell one depth from another, so the untraced scan was served the traced tree.
- **`HEAD` leaves the tree signature for an untraced tree.** That is the point of the split
  arriving in this file: a tree with no git in it cannot be made wrong by a commit, so
  committing to ceph stops throwing away a 36MB tree.
- **Stopping is per-file and what it read is kept.** The blame pass and the parse both check a
  flag; the log walk is one `git log` and is not interruptible, which is said rather than
  pretended about. A stopped scan returns an error rather than a partial tree — half a parse is
  not a smaller map, it is a wrong one — and the work survives in `scancache`, which flushes
  every 400 entries. A stopped depth 2 reports as depth 1: the map may not claim a resolution
  it only has in places.
- **The sidebar row is three pills, and the button IS the gauge** (`Phases`). One per phase,
  fixed width, three across: the background fills with progress, the label is a verb and a
  price, and a phase with nothing left to do stops being a button and becomes a flat marker.
  **Two shapes were tried and thrown away, and both failed the same way.** Prose lines with a
  button at the end read well for one project and not at all down a list — the numbers sit at
  different offsets and the lines appear and disappear as phases complete, so no glance answers
  "which of these is done". Dials fixed that half and inherited the other: the state became
  scannable while the buttons stayed behind a hover, so the row that most needed acting on was
  the one that looked most inert, and bare numbers under unlabelled rings (`89 files`, `127`)
  had lost the nouns that made them mean anything.
  Unifying the two fixes both. Nothing is hidden, because the state and the verb are one object;
  nothing is prose, because the label is a verb and a price; and **the pressable things on
  screen are exactly the work outstanding** — a finished project has no buttons at all, which is
  a better glance than any amount of shading. Progress is a horizontal FILL, because length is
  what the eye compares at this size: three 24px rings at 60%, 100% and 100% all read as "a ring
  with some colour in it".
  **A dash is not a zero.** No git history, and "nothing to trace until it is scanned", draw as
  a dash — the same rule the lens panel follows, one screen over.
  **A pill is a verb and nothing else, and the numbers are under it.** `Trace 5,249 files` clips
  to `Trace 5,…` in sixty pixels — losing the number, the noun, and any sign that anything was
  lost — and shortening it to `Trace 5.2k` buys the fit by throwing the noun away. So the detail
  moved to a line below the pills, where it has the width to be a sentence: **the phase under
  the pointer, else whatever is RUNNING, else nothing.** Hovering is somebody asking about that
  phase and wins outright; with no pointer on the row it carries the one thing that moves on its
  own; **idle and unhovered it grows a `Sprig`** — one fine stem of the wallpaper's own leaves,
  seeded from the project key so every row differs, mixed with the session so the garden is new
  each launch, and memoised so the 1.5s poll cannot make it flicker.
  It was blank first, which left a strip of empty tile under every settled project. The repo's
  dimensions were tried next and are the better SENTENCE — the pills are all fractions, and a
  fraction cannot say whether `Read` means a hundred functions or two hundred thousand — but a
  row with nothing to do should not be asking to be read at all. The dimensions are one hover
  away, on the Scan pill.
  **`Bloom`'s own leaf, which is why `leafPath` is exported from it.** A second vesica drawn by
  hand would be a second answer to a question that one has already answered. The rose came too
  for a while, as an occasional bud on the stem, and went: at a fifteenth of its size a flower
  is a dot with a suggestion of petals, and a dot on a line reads as a blemish. And it is the
  vine `Bloom` could not have: its note
  records that stringing the flowers along a sine stem looked wrong because a wave long enough
  to read as a vine is longer than that pane is wide. In a strip twelve pixels tall the
  constraint inverts — there is room for two undulations and none for a scattered field.
  The height is fixed either way, so nothing moves as the pointer crosses the list.
  **A note has about thirty-four characters and every one of them fits.** The line truncates, so
  an overlong note does not break the layout — it just stops saying the thing it was written to
  say, at the end, where the answer usually is (`84k / 123k commits · building the ti…`). What
  gets cut when they are trimmed is the word the reader can infer: the pill says `Stop`, so a
  running note need not say what it is doing; the scan's phase name goes once there is a count,
  because the count is the half that moves.
  **One surface, one sentence: nothing in the tile carries a `title`.** The pills did, and
  hovering produced the note AND a native tooltip saying nearly the same thing a few pixels
  lower, landing on top of the line it duplicated. So did the whole ROW, which fired wherever
  the pointer sat — including over the pills. What survived is on the thing it qualifies rather
  than the tile that thing is in: the repo path on the name, because two checkouts of one repo
  are two rows with the same word in them, and why a run ended on the chip that says one did.
  **A row renders nothing it has nothing to put in.** The run controls kept a reserved 16px
  for the count and the Read button they used to carry, which after the move was a strip of
  empty tile under every idle row — the list spending its own height saying nothing.
  **The coverage rule along the bottom edge is gone, and the pills are why.** It drew
  `assessed / total`, which is exactly the Read pill's own fill, and the scan's fraction while
  scanning, which is the Scan pill. One fact drawn twice in one tile is worse than once: they
  cannot disagree, so the second one asks to be read as something else, and every guess about
  what it might be is wrong.
  **A press is acknowledged before the backend answers.** Everything on a row arrives on the
  1.5s poll, so a fast phase finished before it looked started — per-line blame on this repo is
  0.35s — and a slow one looked ignored for a second and a half. Both read as a dead button, and
  the second gets pressed again. The pressed pill goes busy until any of the things the row is
  FOR moves: the depth, whether something is running, the scan counter, the coverage.
  **Opacity is not a semantic channel, and using it as one is paid for in legibility.** The tile
  had it saying four things — not pressable, pressed, not applicable, secondary — each of which
  dims the LABEL to make a point about the CONTROL. Measured at 10px on `--card`: a finished
  pill's word 3.92:1, a pressed one 3.61:1, the note line 3.70:1, the dash 2.15:1, against a bar
  of 4.5. **None of it was the palette** — ink on the tile is 14.64:1 and ink on the marker's own
  fill 6.89:1 — so no hex changed. The meanings move to channels that cost nothing (a border says
  pressable, a tick says finished, a dash says the question does not arise) and what is left is
  one measured token, `--note-ink`. `--muted-foreground` was the obvious candidate and fails at
  3.17:1. A pressed pill dims its GAUGE, never its word.
  **A finished phase is then the QUIETEST thing in the row, and briefly it was the loudest.**
  Taking the blanket opacity off left a done pill drawn as a solid accent block with full-strength
  ink — which is what a primary button looks like, beside two outlined ones that were the actual
  work. A finished gauge carries no information: it is full by definition and the tick says so,
  so it goes faint. Markers that are outstanding-but-unpressable keep the strong fill.
  **The gauge is CHAMBERS, one per step, and their boundaries are not drawn.** The trace is three
  depths at roughly 1:10:100 (ceph 6.5s / 206s / minutes), so a single bar at a third claims the
  cheapest step is a third of the wait. Equal chambers keep the divider positions identical on
  every row, which is what lets a list be compared at a glance; weighting by measured seconds
  moves them per repo and makes the first chamber 2% wide on ceph. The boundaries were drawn for
  a while and removed: the note line one row down already says which step is running, in words.
  **One press buys the whole column.** `chaseTrace` walks scan → blame → replay, asking
  `phasesOf` what comes next rather than re-deriving the ladder, and the guards are keyed per
  PROJECT — a single slot made a chain on kibana silently swallow the press on every other row.
  **Two numbers that get divided must be counted in one place.** The Trace pill divided files
  blamed by the file count printed beside it, and those are counted differently — one is what a
  reader could be handed, the other is every file node the trace walked — so the fraction could
  not reach one and the pill went on offering work that was done. `resolved` and `resolvable`
  are set together, by the pass itself. And **a pass that ran to the end resolved everything**,
  whatever its blame count says: a file git has never seen blames to nothing by design, so
  counting successes leaves a repo with one untracked file at 99% forever. Only a STOPPED pass
  reports the count, because only there is the gap real.
  **The chip on the name line is news the pills cannot carry, which is one thing: a failure.**
  It said `Scanning` while a scan ran and `5 reading` while a wave did — and that phase's pill
  already says `Stop`, fills with its progress and puts the count on the line below without
  anybody hovering. Three marks for one fact, and the asymmetry is what gave it away: a trace
  got no chip, because the chip predates the trace having a pill. The answer to "why does
  scanning get a label and tracing not" was that scanning should not have had one either.
  **One answer to "is this repo busy", wherever the work is.** The sweep along a row's bottom
  edge and the pulsing glyph both belonged to READING, so a scan of kibana or a replay of ceph
  ran for minutes with nothing on the tile saying so beyond a fill creeping inside one pill —
  which is what "I see no sign anything is happening" looks like. All three phases can take
  minutes; they share the mark.
  **A control that cannot be pressed keeps its WORD.** A replay blocked by another repo's walk
  showed the outstanding count instead — a bare `340` in the middle column, which reads as a
  measurement of something rather than a control that is unavailable. The count and the reason
  go in the note together.
  **Every phase's controls are its pill, including the stops.** A run's Stop had a row of its
  own below — where all three phases' controls used to live — and once the others moved up it
  was one loose button floating over the sprig, in the tile slot that is meant to be quiet. A
  wave has a stop, a count and a fraction, and a pill is already all three. The row of loose
  controls is gone with it, and the failure transcript moved onto the words that report the
  failure: a chip saying `Read failed` that cannot be asked about it is the dead end.
  **The pill names its own action** (`PhaseAction`) rather than the row inferring one from a
  verb and a column: `Trace` means the commit log on an untraced repo and per-line blame on a
  traced one, and working that out a second time is two implementations of one answer.
- **The replay is the trace pill's last third, and the pill says `Trace` the whole way down.**
  A fourth row under a row claiming to show three phases was the row contradicting itself. The
  step did relabel itself `Replay` for a while, on the argument that walking every commit for
  the first time is a different act from pressing play on a built timeline — true, and beside
  the point at the size of a pill: **a button that renames itself mid-sequence reads as a new
  button that has appeared**, and the reaction it got was "what is replay?" where a third press
  of the same verb would have got none. One word for the column, and the note says which step
  this is and what it buys (`45k commits → the timeline for History`).
  It is worth being straight about what that conflates: tracing reads git onto the map you are
  looking at, and the timeline is data for a different VIEW. They are one control because they
  are one cost — git history, in three sizes — and the phase is on the hover for anybody who
  cares which. Its progress is that pill's fill, its count is the note, and its Cancel is the
  pill saying `Stop`; the block it used to have held exactly those three, drawn a second time.
- **A scan is gated too, and its budget is its own.** `scan::BUDGET` is ten seconds like the
  trace's and arrived there separately — the two scale with unrelated things, and sharing one
  constant would tie them together for no reason. Pricing is free: `KnownProject` banks the last
  scan's file count AND its milliseconds, so the rate is a lookup, and it is measured rather
  than assumed because a debug build parses several times slower than a release one — a measured
  rate learns that, a constant is wrong in one of the two forever. A repo whose size is unknown
  is NOT refused: it is one walk from being known, and refusing leaves a row carrying a question
  with no way to answer it. What the budget is for is the case where the size is known and large.
- **One repo must not take the whole blame pool, and the floor is per PROJECT, not a
  percentage.** Blaming kibana is 59,008 files at ~38ms each; press Trace on a second repo and
  its work went to the back of the same queue, so a 90-file repo — 3.4 seconds — sat behind
  thirty-three minutes of somebody else's, and a starved pass is indistinguishable from a hung
  one. **Sample before theorising: all nine rayon workers were asleep in `Command::output`**, so
  the resource is a SUBPROCESS SLOT and not a core, which is why oversubscribing costs nothing.
  `blame::slots` gives every project with work outstanding a floor of one slot and lets whoever
  wants the rest have it (`allowance = max(1, total - others)`). A percentage does not scale —
  a tenth of nine slots is ONE slot, shared by however many projects are waiting — and a flat
  cap is unconditional, so a repo running alone would give up a ninth of the machine forever.
  Nothing is preempted: slots turn over per file, about every 4ms. **Counting the WAITERS is the
  half that is easy to omit** — a project parked holds nothing, so an incumbent looking only at
  holders sees an empty field and takes back every slot it frees. Each pass also gets its own
  rayon pool, because what starved the second repo first was the WORKERS: on a shared pool the
  big repo occupies every thread and the newcomer's tasks are never scheduled to even ask.
- **`behind` is the one state where a map is knowingly out of date.** The watcher takes the scan
  budget as well, so a large repo that moved is kept as it was, flagged, and offered a rescan —
  small repos are repaired within a tick and never reach it. The scan dial draws full and
  HATCHED, which is the map's own mark for "true when it was taken".
- **The add dialog explains, and the checkbox hides the EXPLANATION rather than the choice.**
  A repo over budget arrives with its history unread whether or not somebody has ticked "don't
  explain this again", and its row still says so. That is what makes the checkbox safe to tick.

