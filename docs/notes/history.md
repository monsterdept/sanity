# History replay

## History is replayed, never re-measured

`history.rs` grows the same rings one commit at a time. It is a second *view*, not a
second metric, and the line between those is the whole design.

- **Surprise is not replayed, and the lens switcher is disabled to say so.** A
  temperature is a reading taken against the code as it is NOW; stamping it onto the same
  function's 2019 body would be the map claiming a measurement nobody took — the same sin
  as a stale reading keeping its colour. What a frame is coloured by is recency, *as of
  that frame's own date*, which is a fact about the commit stream and the only thing this
  module reads. Greyed rather than hidden: remove the switcher and the rings are recoloured
  with nothing on screen saying by what.
- **The end of the replay is the live map.** A story that arrives somewhere other than where
  you already were is not the same repo told forwards, and for a long time it was not: blame
  ranked one way replaying and another way standing still, so opening History recoloured the
  entire cast. Same people, same spelling, different slots. It was two questions wearing one
  name and nobody had noticed they gave different answers.
  Replaying, a person is an IDENTITY, and three rules were tried that each went grey somewhere:
  ranking every frame recoloured the cast as it ran; seeding from today's ranking made the
  OPENING grey, because the people who start a repo are rarely its biggest by the end (ceph's
  `rgw` drew `other (6)`); assigning by arrival made the ENDING grey, the first sixteen holding
  the palette until their lines were gone. All three derived identity from whatever happened to
  be visible, so the ranking is `stats.authors` — the whole repo's cast, ranked once over the
  whole log, independent of the playhead.
  **That ranking is now the live one too, and the argument it displaced is written down here
  because it was right when it was made.** Live, a person was a category of the picture in
  front of you: standing in one kibana directory, its biggest authors are not the repo's, so a
  repo-wide order spends the named slots on people with nothing on screen and the wedges you
  came to look at drew neutral. What changed is the palette. That was written when past the
  named slots was one shared grey; it is now sixty-four colours recycling out to a thousand, so
  a drilled directory's people still get colours of their own — they just do not get NAMED in a
  legend that holds sixteen. The price used to be the picture and is now a caption, which is
  what makes the invariant affordable. If a drilled repo reads as anonymous, this is the trade
  to revisit first.
  **`langRank` still ranks over the drill, and that is not an inconsistency.** A language is
  genuinely a property of the code in front of you and there is no cast of languages spanning a
  story to rank against; its history tail exists for the opposite case, a language the repo has
  since migrated off, which has no wedge at HEAD to be ranked by.
  **A language has ONE name, and it did not for months.** A scanned node's language crossed
  the wire through `Lang`'s derived `rename_all = "lowercase"` (`cpp`); a frame's came from
  `Lang::label` (`C++`). Every colour a categorical lens gives out is keyed on that string and
  nothing joined the two spellings, so on ceph the twelve live languages held slots 0..11 and
  every language in a replay was read as one the map had never seen — taking a tail colour, in
  an order that had nothing to do with size. It looked like a palette bug and it was a
  vocabulary bug. The label wins because it is the half a person reads, and it is applied to
  `Node::lang` alone rather than to the enum: `Lang` is stored in `scancache::Entry` too, and
  that cache memoises `git blame` — changing its representation would buy a repo the size of
  ceph an hours-long re-blame to fix the spelling of a caption. Here it costs a tree cache,
  which is a rescan the parse cache already makes cheap. `treecache::VERSION` 8 → 9 in the same
  commit, because a version-8 tree holds the old spelling and it would read back as no language
  at all.
  **A legend may never invent a rank the map does not use.** It filled gaps from its own ordering
  (`?? categories.indexOf(c)`), and `stats.authors` is CAPPED, so on a big repo it named eleven
  people in eleven colours over a picture where every one of them was the shared neutral — the
  key and the map disagreeing about the same wedge, with the key sounding more authoritative.
  Unranked is `other`, which is what the movie key had always done one surface over.
- **Complexity IS replayed, and it is the only lens off the parse that is.** The walk already
  re-parses every version of every file a commit touched — that is how it finds the functions
  — and `parse_functions` computes the cognitive count on the way past, which the walk was
  throwing away. So a frame banks `cog`, one score per function per commit, for no extra
  parse and one sparse array on the wire.
  **It is its own array rather than a third slot in `set`, and the absence is why.** A
  language with no branch table has no score, which the lens draws in the structural neutral;
  a sentinel inside `set` would be a number the fold could mistake for one, and zero is a real
  and common score — most short bodies never fork.
  **The count is sent, not the ramp position.** A position needs the repo's size-band medians,
  and those come once with the tables, derived from the state the last frame leaves — which is
  HEAD, which is what the live map bands against. One yardstick for the whole story, so a wedge
  changes colour when its body changes and at no other time; re-deriving the medians per frame
  would recolour an untouched function every time the repo grew around it. The price is the one
  place in the app where a ramp is solved twice, in Rust and in `colorMode.ts`, and
  `tangle::tests::the_window_solves_the_same_ramp_this_module_does` reads the other file rather
  than trusting the comment.
  **Callers and Reach do not follow, and the difference is not effort.** Complexity is a scalar
  a body has on its own, so it changes exactly when that body changes and a delta can carry it.
  Fan-in is a property of the GRAPH: function X's colour moves when some other function starts
  calling it, so there is no commit whose diff names X. Replaying those means carrying every
  function's call list per frame and resolving the whole graph per frame — which is the
  quadratic encoding `HistoryCommit` exists to avoid, done thirty times a second.
- **Nothing before the window makes a claim about its own age.** Functions folded into the
  opening frame have no touch date, so they draw uncoloured. Dating them to the edge of the
  window would open every truncated repo with the entire codebase flaring as though someone
  had just written it.
- **Only changed files are re-parsed.** The obvious implementation checks out each commit
  and scans — a full scan per frame, minutes for a repo the live map draws in a second.
  The walk carries parse state forward and re-parses exactly what each commit touched, so
  the cost is file *versions* in the window, not commits × files. tonepoet: 984 commits,
  17k functions, 57s cold.
- **It must refuse what the scan refuses.** History has no `.gitignore` walker to lean on,
  and the first version drew a committed 161-function mascot bundle the scan skips as
  minified — 769 functions at HEAD against the map's 472, with the largest wedge in the
  story a file the map does not show. `MINIFIED_LINE_BYTES` and `VENDORED` are duplicated
  here on purpose and have to move together. A refused blob yields an EMPTY state, never
  no state, or a file that turns into a bundle keeps its old wedges forever.
- **The cap is a backstop, not a window.** It was 400, chosen against the scrub bar, and it
  cost the feature its point: tonepoet opened with 584 commits already folded in, so the
  directory structure existed on day one and the story started in the middle. Addressing a
  commit is the log's job and the log addresses all of them. So there is no cap at all now:
  `history::ALL_COMMITS`, and `churn` walks whole for its own reason (a capped total is a
  longer window with no label on it). The two agree by arriving there separately.
- **The cache is machine-local, and that is the same rule `.sanity/` follows from the other
  side.** The repo holds what cannot be recomputed; a timeline is derivable from the repo's
  own object database in full, is megabytes, and changes on every commit — in-repo it would
  be a conflicting blob on every branch and a dirty `git status` after merely looking.
  A failed cache write is silent for the same reason a failed *reading* write must not be:
  nothing is lost that git cannot produce again.
- **A cached timeline is EXTENDED, not rebuilt.** A commit's diff is immutable, so the
  frames cannot go stale the way a score can; a working day's commits are appended and the
  overflow folded into the opening state. `Replayer::resume` derives its parse state by
  folding the frames rather than storing a second copy — a stored copy could disagree with
  the frames, and the disagreement would be invisible, with new commits diffing against a
  state nobody can see. `extending_a_cached_timeline_matches_replaying_it_whole` and its
  fold twin are what keep a warm machine and a cold one telling the same story; keep them
  passing. A rewritten history (`merge-base --is-ancestor` says no) is replayed, never
  appended to — appending would produce a timeline that never happened.
- **The transport sets a DURATION, not a rate.** It was 1×–8× commits per second, and a
  rate cannot be right for two repos at once: eight a second is six seconds of this repo
  and two minutes of tonepoet, so one button meant "a glance" on one project and "go and
  make coffee" on the next. Nobody is choosing commits per second; they are choosing how
  long they will watch. Past `MAX_FPS` the clock SKIPS commits rather than falling behind
  — every frame is computed from its index, so a step of forty is as correct as forty
  steps of one, and the label stays true on a slow machine. The clock must never depend on
  `index`: an effect rebuilt per frame re-reads its own start time, and the replay
  silently overruns the duration it promised.
- **The frontend replay is forward-incremental; the fold is not.** A from-scratch fold is
  linear in how far along you are — 1.3ms at tonepoet's commit 98 and **26ms at 983** — so
  the map got slower exactly as the story got interesting and the top speed was set by the
  tail. `advance` mutates a memoised frame forward. Churn therefore keeps touch STAMPS, not a
  count: the 90-day window moves with the playhead, so a count could only be recomputed from
  the start.
- **Scrubbing BACKWARDS thaws a checkpoint, and never undoes a commit.** Undoing one needs the
  state it replaced, which is the whole timeline stored twice and free to drift; a checkpoint
  is a state the fold already computed. `Frame` is dense typed arrays keyed by function index
  so that a checkpoint is a `memcpy` rather than a walk over eight maps, every absence is a
  sentinel that no measurement can produce, and the bank is bounded by a count AND a byte
  budget. **The frame a seek produces must be identical to the one playback produces** —
  `just replay-check` folds a synthetic timeline to the same commit three ways and compares
  the trees field by field, and asserts on `cost` that the seek folded a bounded remainder,
  because a seek that thawed nothing is correct and slow and no comparison of trees can see
  it. Read `docs/backward-scrubbing.md` before touching any of it.
- **Drilling narrows the timeline, and that is a VIEW, not a second fold.** A directory's
  transport and log list only the commits that touched it — otherwise the scrub bar spends
  most of its length on commits that change nothing on screen. But the rings are still
  built at the REAL commit: a commit outside a subtree cannot change what is inside it, so
  the narrowed list is complete for what is drawn, while folding only the scoped commits
  would give the frame the wrong DATE, and the date is what the colour means here.
  `histIndex` therefore stays a real index and the transport speaks positions in the scoped
  list — which is also what makes drilling in and popping back out land on the same commit
  rather than somewhere proportional. The prefix test is segment-wise, or `web/src` takes
  in `web/src-old`.
- **A replay is a periodic-stutter detector for the whole window.** Every timer in the app
  became visible the moment something ran at thirty frames a second, and each one was a
  hitch on a fixed period: the 2s reading poll fetched all 16,925 of tonepoet's readings
  and folded them into a tree that is not on screen during history; the 1.5s project poll
  replaced an unchanged list, which rebuilt the frame tree (`activeProject` is a fresh
  object every poll — depend on its NAME) and re-rendered several thousand arcs. Poll
  results are now compared before they are stored. **If the replay stutters on a period,
  look for a timer, not for the renderer.**
- **Function nodes are pooled; containers are not.** A frame of tonepoet is seventeen
  thousand functions with a `Score` apiece, and building them fresh thirty times a second
  hands a million objects a second to the collector. They are mutated in place instead —
  but dirs and files must stay freshly allocated, because the sunburst recomputes its
  layout when the node it is rooted at changes identity, and a pooled root would freeze the
  map while the data underneath it moved. 700 allocations against 17,000, with none of the
  hazard. A full sequential playback of tonepoet costs 1.1ms a frame.
- **`warm` tops up a timeline; it cannot create one.** Prefetching on open would charge
  every open of every project a minute of parsing for a mode most opens never enter. Once
  a repo has one, keeping it current costs the commits since — so History opens in 0.2s on
  the repo you are actually working in. Ask for it once; never be charged for it unasked.
- **The functions page in beside the deltas that name them.** `tables` used to carry every
  function every version of every file ever had — on ceph 19.8MB of a 20.1MB response, sent
  before a single frame could be drawn. A PREFIX is a complete answer, which is what makes
  it pageable: `intern` appends a function the first time the walk meets it and the walk runs
  oldest-first, so a fold of commits `0..=n` can only name functions from the front of the
  list. `Deltas.ensure` takes the highest index a block mentions and tops `Funcs` up **before**
  the block joins `have()`, because the fold is synchronous and a frame drawn against a hole
  is worse than a frame that waits. The watermark is computed on the window's side: those
  numbers are already being parsed there, and a round trip to be told the maximum of
  something already in hand buys nothing. Measured on ceph: `tables` 20.9MB → 1.0MB, first
  view 22.3MB → 6.9MB. It is not 20× because ceph's opening block is an SVN import that lands
  62,804 functions in its first 2,000 commits — that 4.5MB is genuinely needed to draw the
  frame, and the honest next win is a compact encoding, not a later fetch.
- **The roll-up cut is a share of the CIRCLE, and when you drill the circle is the subtree.**
  `minLoc` is `frame.lines / 4000` — right at the root, and far too coarse anywhere else,
  because the lines it divides were the whole repo's while the wedges being drawn belong to
  one directory. Standing in ceph's `src/mon`, 44,160 lines of a repo hundreds of times
  larger, that meant five functions drawn and everything else rolled into `206+`, on a ring
  with room for hundreds — drilling is the gesture that asks for detail and it could not
  deliver any. The live map never had this: its cull is per-wedge ANGLE, and an angle grows
  when you drill. `frameTree` takes a `scope`, and inside it the cut is that subtree's own
  lines; outside it stays coarse, so the fold is not paying to build nodes nobody will draw.
  The extra pass is the one the incremental `frame.lines` exists to avoid, so it is paid only
  when drilled — at the root there is no scope, no pass, and the arithmetic is what it was.
  The scope comes from the drill STACK, never from `focus`: focus is resolved against the
  tree this builds, so asking it there is a cycle.
- **Two roll-ups, two id namespaces, and the ghosts came from forgetting that.** The replay
  folds a per-file stand-in for everything too thin to draw, and `tileFunctions` mints its
  own for the members a wedge cannot hold — both were `${path}#rest`, and in a replay the
  second rolls up the first, so the pair arrived as siblings in one file's patch array.
  React's answer to a duplicate key is that children "may be duplicated and/or omitted": it
  duplicated one, lost track of the copy, and never rendered it again. That orphan is the
  ghost — a wedge frozen where it was born, sitting outside the rings while the map moves
  under it, cleared only by a remount. The fold's is `#folded` now.
  **What made this findable was the wrong theory dying on one observation**: "they stay in
  place as I move the timeline". Legitimate wedges are rebuilt every frame, so anything that
  holds still is stale by definition, and the deep-narrow-branch story — which is real, and
  does explain the labelled islands like `src/tools/rbd` — cannot explain a mark that never
  moves. Diffing two frames of an exported replay put it beyond argument: the region was
  pixel-identical across 23 seconds while labels 100px away had moved. **A screenshot shows
  what is on screen; a diff of two shows what is not being redrawn.**
- **Dressing the window for a replay waits for the FRAME, not for the request.** `historyOn`
  is a request; on a large repo it is true for a few hundred milliseconds while the map is
  still drawing today. The lens, the sort order, the legend and `morph` were keyed on it, so
  pressing History repainted the live map in Age's greens and then repainted it again as the
  replay's first frame. `replaying` (the request AND a frame to show) is the key for all of
  them, so it happens once.
- **Morphing starts from the picture on screen.** `geo` seeds a wedge the chase has never
  heard of at zero angular width so it OPENS rather than appearing — right for a file that
  shows up mid-replay, and catastrophic for the frame morphing is switched on, when the chase
  has heard of nothing and every wedge on screen is therefore new. The whole map collapsed to
  the hub for a frame and bloomed back out. `soft` is primed from `target` on the first
  morphing render, and primed during RENDER rather than in an effect: `geo` runs first, so an
  effect would prime a map that had already been seeded at zero and the blank frame would
  paint anyway.
- **A frame costs what the PICTURE holds, not what the repo holds — and that took three
  measurements to get right.** kibana stuttered where ceph did not, which is not the commit
  count: the transport is a duration, so at 5x kibana folds 589 commits a frame and ceph folds
  683. Timestamps pulled out of a screen recording settled the shape — macOS emits a frame only
  when the screen CHANGES, so they are a log of when the app painted — and the gaps were
  irregular and GREW with the playhead, which is work proportional to the tree rather than a
  timer. Measured on a synthetic frame the shape kibana builds: the fold was 33ms and building
  the tree was 117ms. **Pre-aggregating the deltas would have bought a fifth of the wrong
  half**, which is what the measurement was for.
- **So the tree is built top-down and only where there is something to see.** `minLoc` already
  rolled a function up before a node existed; files and directories take the same rule, which
  is what the layout was doing anyway — the "9,022 files too thin" note in the corner IS that
  population, and the fold was building sixty thousand nodes for the layout to discard. Totals
  per directory first (one add per ancestor per live file), then descend while a subtree is
  worth drawing. A large repo went from ~120,000 nodes a frame to a few hundred. **The scope's
  own ancestors are forced**: a drilled view resolves its root by id, and pruning the chain
  would lose it. **Lines are conserved at every size** — that is the invariant this rests on.
- **Containers are pooled with the functions now, and the reason they were not is worth
  keeping.** The argument — the sunburst re-lays-out when the node it is ROOTED at changes
  identity — is right about the root and does not reach its children, since `layout` walks the
  tree afresh and every memo keys on the root. The saving had also been measured on the half
  that stopped mattering: `minLoc` folds nearly every function away on a big repo, so the
  pooled population was almost empty and the frame was made entirely of containers.
- **Three smaller ones, each measured, none guessed.** `advance` rebuilds `order` once per STEP
  rather than splicing each arrival into a 148,000-element array (18.8ms to 0.5ms for 2,000
  arrivals). The per-file accumulators are dense typed arrays rather than maps hashed 148,000
  times into a 60,000-key table — the superlinear term, 97ms where the two halves alone cost 10
  and 17. And `aggregate` writes its `Score` in place; the first attempt allocated AND copied,
  which the harness caught. Together: kibana at 5x went 150.6ms to 47.7ms a frame, and a
  250k-file synthetic 641.7 to 105.7. `histogramsFor` answers only for containers that are
  DRAWN on the same argument, which took Blame from 24.4ms to 5.1ms a call.
- **The replayed author lives on the roll-up stand-in.** It carried a `lang` and no author, so
  Language replayed and Blame did not — and on a repo where every function is rolled up, the
  stand-ins are the whole picture. It takes the file's own last committer, which is the claim a
  file wedge makes one ring in; the warning against a file's author standing in for a FUNCTION
  is about a real function, and this node IS the file.
- **Composition replays because the walk places every body it parses.** It was marked `live`
  and drew every replayed wedge as unplaced: frames were built with `codeKind: null`. Each
  `HistoryFunc` now carries `kind` (`kind << 2 | how`), set by `history::place` from the
  version just parsed, in `score_dir`'s order — the file's own kind, then `edges::testness`
  (the chain `wire` uses), then code — and the latest version wins, so the frame at HEAD
  places a body where the live map does. `.gitattributes` and manifests are read from the
  working tree, as `.sanityignore` is. Two honest gaps: a reader's answer about a test never
  reaches a replay, and a body is one kind for its whole story. The roll-up tallies lines by
  kind per FILE (`Folded.kind`), because a Rust file holds its own tests.
- `just history <repo>` is the headless check, and it is UNCACHED by default: a run that
  answers from a file is not a run of the thing being checked. `--files` prints per-file
  totals to reconcile against the app, which is how the mascot bundle was found.
- **The export draws the map the window draws, off the same component, without the window.**
  Each commit's frame is `frameTree` at export density, rooted where the window is drilled, laid
  out by `mapMarkup` — the markup `Sunburst` renders — and rasterized through an `<img>`
  (`MovieSource`, `movie.record`). It used to copy the live `svg[data-sunburst]` per frame, which
  meant driving the window's playhead, lens, ground and density for the length of a recording:
  the map jumped about behind the dialog and was put back afterwards. Two renderers would be
  pictures nobody has checked against each other; one component rendered twice is not. What the
  picture has to carry is everything a document supplied: the stylesheet's custom properties on
  the chosen ground (`groundVars`, read off `index.css` as text, so a dark window writes a light
  file) and the label face, inlined as woff2. The creature is not in the markup and is not
  composited any more; the hub draws what `center` says, circles by default.
  **It is not a realtime capture, and that is the same argument the transport's duration
  rests on from the other side.** On screen a duration is held by SKIPPING commits, which is
  right for something being watched; a file made that way would be as good as the machine
  that happened to make it. The output's clock is the file's — frame `f` is at `f / FPS` —
  so the movie is the length that was asked for and every commit lands. The map is
  re-rasterized only when the commit under the playhead CHANGES: a minute of a forty-commit
  repo is 1,800 frames of forty pictures.
  **The timeline is fetched per frame and awaited, never in one go up front.** The first
  version pulled every delta before drawing anything, on the argument that a block landing
  mid-export would stall the playhead into the file. Awaiting the one commit about to be
  drawn buys exactly that guarantee and never holds more of the story than the export has
  reached — the version that pre-fetched materialised 123,000 ceph commits before the first
  frame, and the export was then reported as hung.
  **An export names its STAGE, because a frame counter cannot tell working from stopped.**
  One frame of a long repo is hundreds of commits of folding, so `Frame 7 of 300` sits still
  long enough to read as a hang, and did. `Tick` carries fetch/fold/raster/encode with a mean
  cost apiece, which is also the only way to find out which of the four is worth attacking.
  **A bigger file is a bigger CANVAS, not a bigger picture of the same map.** Every threshold
  that decides whether something is worth drawing is a pixel size converted through
  `unitsPerPx`, so density is a property of how large the map is being drawn and nothing
  else — an export that reasons about the pane it was staged from is the same picture
  upscaled. The export lays the markup out at the map's own side in the
  file (`mapSide`), so a 4000px movie shows the files a 1000px one culls.
  **The fold has a threshold too, and it is SQUARED where the ring's is linear.** `minLoc`
  rolls a function up before a node is ever built, so the layout can only draw what the fold
  supplied. A wedge's share of the ring is an angle and falls in proportion to the width;
  a function is not on the ring — `tileFunctions` packs it inside its file's band against an
  AREA, which `unitsPerPx²` already scales quadratically. Scaled linearly, the fold became
  the binding constraint: measured on a synthetic repo of 3,200 files, a 4000px frame drew
  every file and not one more function than a 1000px one. At `density²` the same frame draws
  all 25,600.
  **The codec ladder is H.264 then H.265, and the size is why.** VideoToolbox's H.264
  encoder stops around 8.9 million luma samples — fine for the 16:9 shapes that number was
  written for, brutal for a square, where it lands at about 2985 a side. So 2160² passes,
  3072² would not, and 4000² is sixteen million samples and never had a chance; no bitrate
  or profile negotiates that down. `preflight` tries each codec in turn and returns the one
  that actually encoded ten frames. The fallback is STATED in the dialog rather than silent:
  an `.mp4` that turns out to be H.265 is a different thing to hand somebody.
  **A refusal is the app's own sentence, never the encoder's.** What reached the person when
  4000² failed was WebCodecs' own words — a paragraph about "this browser", naming a profile
  string and a bitrate, in an app that is not a browser and that had another codec and four
  smaller sizes it could have offered instead.
  **The ground is offered as light or dark and never as `system`.** On screen that means
  "follow the machine", which is a live relationship; a file cannot follow anything, so
  offering it would be a coin flip decided by whoever renders.
  Both awaits in the frame loop carry a deadline, and one of them earned it: `decode()` on
  an SVG image is not reliably a promise that settles, and neither is the encoder accepting
  a frame. A wait nothing can interrupt is not one the Stop button can reach either.
  **The encoder stalls at frame seven, and the wait it stalls in has no error path.**
  `CanvasSource` blocks once four frames are outstanding and waits for a `dequeue` event, so
  an encoder that stops dequeuing hangs a promise nothing can catch — there is no exception,
  no rejected promise and no event, only a clock we hold ourselves. Two things are aimed at
  it. `latencyMode: 'realtime'`, which is not about latency here: the default mode lets the
  encoder reorder and look ahead, so it may swallow a run of frames before emitting any,
  which is a deadlock between two components that are each behaving correctly. And a
  **preflight that asks the encoder rather than about it** — ten blank frames at the chosen
  size before the recording starts, because `canEncodeVideo` is `isConfigSupported`
  underneath and it answered yes for a configuration this machine then produced not one
  packet from. Same rule as probing a harness by asking it to LIST its tools.
  Giving it an explicit bitrate (`preferBitrate`, rather than a bare quality level, which
  prefers quantizer-based rate control) was tried first on the same evidence and did NOT fix
  it. It is kept because the quantizer path is the newer and thinner one, but it is not the
  cause. The stage display is what turned "it froze" into a line naming the encoder.
  The MP4 is one of the two things the window writes — the other is a report, see
  [report.md](report.md). `save_movie` takes a path from a native save dialog, refuses anything
  that is not `.mp4`, and the bytes cross the IPC base64 because the alternative shape for a
  byte array is a JSON array of numbers.

