# The ring

## The ring is drilled, not panned

**Size is ANGLE here, and a camera cannot give you more angle.** Unbounded rings plus pan
and zoom was built — a fixed band, the tree drawn to its own depth, wheel and drag over the
top, snaps to Whole / Home / Selection — and thrown away. It works, and it is worse than
what it replaced: past six rings a wedge is a two-degree sliver, and a two-degree sliver
magnified is still two degrees, where drilling makes that same subtree the whole three
hundred and sixty. That is the line between a view somebody can move around and a view they
have to re-root, and it is why depth past legibility is not a camera problem. The branch is
`deep-rings`; read this before proposing it again.

Three things came out of it and are on main:

- **The count is the reader's, within a bounded range** (`lib/rings.ts`, 3–8, default 5).
  It passes the test the reader batch size failed: the consequence of changing it is visible
  immediately, in the picture, so a person has something to base the choice on. A batch size
  hides its consequences in a corpus months later, which is why that slider was built and
  removed. Bounded rather than open — a number box would offer forty, and forty has been
  looked at.
- **`minAngleAt` — the cull threshold is per RING.** An angle is not a width: the arc a span
  subtends is `r × angle`, so the old single threshold measured at `R_OUTER` was letting the
  innermost ring draw wedges four times under a pixel. Wrong in the safe direction, and less
  safe the more rings there are.
- **A container's rim draws a DISTRIBUTION, and "what is underneath" cannot mean "what the
  window fetched".** The rim was a roll-up collapsed to one number — a hot share, a mean age,
  a fraction called — and a mean over forty thousand functions lands mid-scale every time,
  which is why Churn, Age, Callers and Reach drew the same middling ring on kibana. Four
  questions, one answer, because averaging was what was being drawn. It is the same breakdown
  the pane prints, curved onto the wedge it is about, and `contribute`/`sortBuckets` are
  shared so the two cannot become two answers about one population.
  **The population is the whole subtree or there is no histogram.** Function rings are fetched
  per file, so on a large repo the browser holds almost none — and a histogram of whatever
  happened to arrive is not an approximation, it is a confident picture of a biased sample:
  three files with rings, all touched last week, and the directory holding four thousand drawn
  as entirely fresh. A subtree with a hole in it falls back to the roll-up, which is complete
  by construction.
  **`Node::cols` is what closes the hole, and it is columns rather than bands on purpose.**
  A file ships its functions' bucketable numbers as parallel arrays — about 3.7MB across
  kibana's 148,000 functions, against the 75MB of strings `slim` exists to avoid. Bucketing
  in Rust would put `CALLER_BANDS` and `AGE_BANDS` in two languages, and the copy nobody is
  looking at is the one that goes wrong; instead the browser feeds a reused stand-in node
  through the SAME `contribute` a real function takes, so a file with its ring and a file
  without one cannot disagree about which band a number falls in. It moved
  `treecache::VERSION` to 8 — `slim` is what that cache stores.
  **Blame and Language never needed it, and running the columns for them double-counted every
  directory** — once by author, once as `unknown` — because a file already carries its own
  `lastAuthor` and `lang` and files survive `slim`.
  **The reading lenses take the same shape through a different door.** A grade is not a number
  the scan knows, so a column cannot carry one; the readings ride on the file instead
  (`Node::pending`) with two fields the backend stamps on the way out — `loc`, so the bar is
  weighted in lines like every other, and `stale`, because only the backend can compare a
  reading's hash against a body the window was never sent, and counting an expired reading as
  a live one is the one thing this store must never do. **The unread remainder is computed,
  not guessed**: a file's `loc` is the sum of its functions', so whatever the held readings do
  not account for is code nobody has read and goes to the absence bucket. Without it a file
  with three readings out of forty functions draws as fully read, which is coverage off a
  filtered list — the failure `work_left` exists to prevent, one surface over.
  **The categorical tail recycles rather than going neutral, and sharing by ERA does not
  work.** Past sixty-four everyone fell to one grey block — on kibana's root that was
  sixty-one people drawn as a single band, so a rim could not tell a directory one person
  wrote from one thirty people wrote, which is the reading it exists for. The tempting fix is
  to share a colour between contributors whose active periods do not overlap; it is wrong,
  because blame is about LINES and lines outlive their authors — somebody who stopped
  committing in 2014 owns code on today's map beside somebody who started last month, so the
  conflict graph is near complete and there is no schedule to exploit. It is also the family
  of rule the replay palette rejected three times over.
  **What makes recycling safe is that a recycled colour is never a NAMED one.** `slotColor`
  reuses only the slots past `NAMED`, so a collision is always between two people the legend
  does not identify — people who were both grey a moment ago. The distinction given up was
  never held; what is gained is that a crowd looks like a crowd. It is stable through a replay
  by construction: a pure function of a ranking computed once over the whole log.
  **`AUTHOR_SLOTS` is no longer `CATEGORICAL.length` and the two must not be re-tied.** One is
  how many colours exist, the other is how many people can be given one — a rank is worth
  having well past the point where it is worth naming, so the cap moved to 1024 and now
  protects the list rather than the palette. The legend says the tail's shades repeat, once,
  where the claim is made; it counts the coloured tail WITHOUT a swatch, because it has no one
  colour to show, and keeps a neutral row for what is actually neutral.
  **A merged rim segment claimed to be a person, and it was the widest band on the wedge.**
  The rim draws one band per bucket and merges whatever falls under a pixel — right, because
  dropping would silently re-proportion the wedge — but the merge took the largest member's
  color AND its label, and it merged into whatever run came last whether or not that run was
  itself sub-pixel. Two lies followed, both invisible on screen. A real top-ranked author
  absorbed the thin segments behind him and came out wider than his own lines. And on
  kibana's `x-pack/platform` the tail — two hundred and nine people, each sub-pixel, a quarter
  of a million lines between them — merged into one band captioned `Andreana Malama`, in
  Andreana Malama's slot color, the LARGEST segment on the wedge and built entirely out of
  segments too small to draw. It looked like a finding about a person and it was a rendering
  artefact, in every wedge at once.
  Now only sub-pixel runs merge, and only with each other; a categorical merge goes to the
  structural neutral and is labelled with its count, because a band of two hundred people is
  `other` and `other` is what this app calls it everywhere else. A ramped merge still keeps
  the largest member's color — there the neighbours really are adjacent on one scale, and the
  color between them is on it — and still says how many bands it stands for. The sizing rule
  moved to `lib/rim.ts` so `just rim-check` can reach it: the failure mode is arithmetic that
  looks fine, so a harness that knows the numbers behind the picture is the only thing that
  can see it.
  **The number of colors is a control, which is what finally settled the palette argument.**
  It had been four, eight, sixteen, sixty-four, and every move fixed one repo and broke
  another — because the question has two right answers. Somebody studying who owns a codebase
  wants eight colors and a tail called `other`, and that IS the reading. Somebody looking at
  the shape of a four-hundred-author repo wants all four hundred colored, knows it is
  confetti, and is asking for confetti. `CAPS` lets them say which, per lens and stored like
  the ring count, defaulting to the full palette so nothing moved for anyone who does not
  touch it. It does not reverse the recycling note above; it makes it the default rather than
  the rule.
  **The cap is applied to the RANKS and nowhere else.** Every surface here already agrees that
  a category with no rank is `other` — the wedge, the rim, the pane, the legend, the movie key
  — so dropping the entries past the cap is the whole of the mechanism. A `cap` parameter on
  the six functions that read a ranking would be six chances for one of them to be handed a
  different number, which is the drift this file records twice already. The one thing that had
  to change with it is that the unranked now share a single bucket key (`OTHER_KEY`) instead
  of each keeping their own: a fold that leaves two hundred rows all named differently is not
  a fold, and it was what handed the rim two hundred sub-pixel bands to merge back together.
    **The stored map now carries the history somebody paid for.** `treecache::save` runs inside
  `scan()`, and the app always calls `scan()` at `Depth::Untraced` and deepens afterwards — so
  `Cols::of` stamped `-1, -1` on every function on its way to disk and the trace lived only in
  memory. Measured on ceph: all 113,322 functions in the stored tree, no history. What `stale`
  drew at the next launch, before the restore reached that repo, was 123,000 commits' worth of
  history drawn as though there were none.
  `redraw` writes the drawable half again once a trace lands. Only that half, deliberately: the
  whole tree is 36MB on ceph and its extra content is the function nodes, which `deepen` refills
  in about two seconds from caches that already exist — tens of megabytes per repo to save that
  is a bad trade, and the slim half is the one that gets DRAWN before anything else exists.
  **The signature is carried over rather than recomputed**, which is the subtle part: it mixes
  `depth.tag()` and, when traced, HEAD, so a signature taken after the trace would not match the
  one `scan()` computes at `Depth::Untraced` next launch — `warm` would call a warm repo cold
  and offer a large one a rescan it does not need. Keeping the stored header says what is true:
  same files, same parser, best map we have. Nothing reads the slim record's TREE but `stale`,
  which never consults the signature.
  **And `slim` is idempotent now, because slimming a slim tree is a thing that happens.** It
  handed `Cols::of` an empty slice and got back EMPTY columns — not `-1`s, which draw as an
  absence, but nothing, so a rim would drop every line in the file and re-proportion around what
  was left. Nothing fails and nothing logs; the picture is just wrong.
  **A roll-up stand-in is a COUNT, and a count is not a member of a distribution.** This is
  the one that produced the report, and it is a REPLAY bug wearing a scan bug's clothes. A
  frame folds every function too thin to draw into one stand-in per file — `history.ts`'s
  `standIn`, which carries their combined lines and, by design, no reading — and `contribute`
  counted every one of those lines as an absence. `aggregate` already skips these nodes for
  the same reason, in the same words; the bucketing walk never learned it.
  What it looked like: ceph's replay drew as `no git history` over a repo with 123,000
  commits, 890,200 lines of it in `src` alone, while the same repo with the replay CLOSED was
  fully coloured and the panel beside it listed 90,878 functions with ages. The give-away is
  that it is a GRADIENT — an early frame is almost entirely coloured, a middle frame has grey
  through its inner rings, the last is mostly grey — because the later the frame the more
  functions there are to fold. A bug about missing history would run the other way, which is
  most of why this read as a data problem for two days. The marker is `rest`: the backend
  never sets it and the layout mints its own after this walk, so a node carrying one in the
  tree is a roll-up and nothing else.
  **Skipping them outright was the first repair and it went one step too far.** With the
  roll-ups gone the distribution was drawn over whatever the frame happened to materialise, so
  ceph's `src/pybind` — 71% Python and 29% TypeScript, measured — came out as 100% TypeScript
  over 517 of its 195,516 lines, with the file count admitting 183 where the directory holds
  1,152. A biased sample stated with total confidence is the failure `histogramsFor` opens by
  naming, and it is worse than the mislabelled absence it replaced, because nothing about it
  looks wrong.
  **So the fold carries a tally of what it dropped** — see `Node.folded`. Per FILE, which is
  what makes it affordable: a language and an author are facts about a file, so a fold that
  already visits every file it drops can total them on the way past, against the alternative
  of materialising per-function columns for everything the picture is not drawing — the work
  the fold exists to avoid. It is also the grain the LIVE map answers at whenever a ring has
  not arrived, so the two pictures agree rather than one of them guessing finer.
  **Age and Churn needed the frame to learn something new, and it did.** A language and an
  author are facts about a file, so the fold could already total them; a band is a fact about a
  FUNCTION, and there was nothing at file resolution to total. So the frame keeps `pathTs` and
  a `pathHits` ring per path — stamped in the same loop that already writes `author[p]`, from
  the same list of paths a commit touched, one write per file per commit. The tally then
  carries `[days, commits, churn, lines]` per folded file, RAW: a band is `colorMode`'s answer
  and a ramp needs a span the fold has never heard of, so the fold reports what it measured
  and `contribute` bands it by calling itself — one definition of a band rather than two.
  The churn ramp rides in the tally rather than being recomputed where it is read, because its
  saturation is the replay's own; without it the bucket has a band and no mean, and a ramped
  bucket with no mean draws an EMPTY fill, which is a segment nobody can see rather than an
  error anybody can.
  **A checkpoint carries both new arrays, and that is the part with teeth.** A field left out
  of `bank` comes back empty rather than missing, and empty reads as a valid answer — a folded
  directory with no age at all, rather than one that failed to thaw. `replay-check` renders
  `folded` into its fingerprint for exactly this: drop the two arrays from `thaw` and it fails
  at the first seek past a checkpoint.
  Callers, Reach, Clones and the reading lenses still say nothing about a roll-up. There is
  nothing at file resolution to answer them with, and a band invented for a fold is a reading
  nobody took. One consequence stated out loud: the rim's
  total is now further from the wedge's line count than it was, so the tooltip stopped saying
  `% of this directory` — a rim has always counted function lines, and in a replay most of a
  wedge can be folded away.
  **A band says what it knows, never what the repo is.** Age and Churn labelled a function
  with no git `no git history` — a claim about the REPO made from a per-function null. On
  ceph that drew as 94% of `src` having no git in it, with the commit log open in the panel
  beside it and 123,000 commits in the header. Measured end to end, every backend path fills
  every function: untraced scan 0%, after `deepen` 100%, and the columns the window receives
  100%. So the data was right and the words were wrong. The distinction the band was trying
  to make already exists one surface up — `locks` asks whether the trace has been read BEFORE
  it says a folder has no history, with a comment on why that order matters — and it belongs
  there, once, beside the button that answers it. `ScanStats::withoutHistory` stays unwired on
  purpose: it would take a sixth parameter through `contribute`, `bucketsFor` and
  `histogramsFor` to say something the lens says better.
  Two things the measurement turned up on the way and neither is fixed: the traced tree is
  never written to disk — `treecache::save` runs only inside `scan()`, before `deepen` — so
  the stored map is untraced by construction and every launch re-derives what somebody already
  paid for; and `slim()` on an already-slim tree returns EMPTY columns rather than the ones it
  has, because `Cols::of` reads children a slim file no longer holds.
    **Surprise is the one lens whose pane breakdown is not `bucketsFor`** — it is `Spread`,
  counted in `summarize` by FUNCTION rather than by line, because its rows are lists somebody
  clicks. The rim reproduces its categories, colours and order and differs in exactly one
  stated way: segments are lines, like every other rim, because a wedge's width is lines and
  a bar inside it measured in something else would be two units in one shape.
  **One direction for every breakdown: the loud end leads.** Churn and Age were already there
  and the rest have followed them, in the pane as well as on the rim. It was per lens — each
  bar running the way its own ramp's legend runs — which is defensible for a list read
  downward and stops being so when the same breakdown is curved onto a wedge, where the order
  is a DIRECTION compared between neighbours. `sortBuckets` is the one definition and the rim
  takes its output unchanged, so the two cannot disagree.
- **A folded directory keeps a HANDLE, not its share.** Folding is somebody saying
  *disregard this*, and until the handle existed the map did not: the subtree kept every
  degree its lines had earned and merely stopped drawing its insides, so folding kibana's
  `x-pack` left the thing you wanted out of the way owning two thirds of the circle. That
  is a depth control wearing an exclusion control's label. The fold now gives that angle
  back to its siblings and leaves a fixed stub where the share was.
  **The ring is then no longer proportional, and that is a suspension of this map's one
  claim.** It is taken deliberately, because the claim was already conditional in three
  ways the app states out loud — drilling re-normalizes the circle to a subtree, sub-pixel
  wedges are culled, thin siblings roll up into `206+` — so what is actually promised is
  *within this view, angle is lines*, plus an obligation to say what is missing. A fold
  joins that list: reader-initiated, reversible, and marked.
  **Consent is implied by the gesture; the MARK is what has to survive it.** A dialog
  confirming an ⌥-click is a modal asking somebody about the thing they just did, and it
  aims at the wrong moment — the hazard is the window somebody comes back to an hour later,
  or the screenshot they hand over. So the handle is hatched rather than filled (a narrow
  wedge would claim to be a small thing, and what gets folded is usually the largest thing
  in the ring), it carries no label, the corner chip NAMES a single fold and prices it
  (`x-pack folded — 62% of this view`), and the hover says the share was given back to the
  ring. Priced against the VIEW's lines, never the repo's, because the circle is the view.
  **Handles are never culled for thinness and never take more than half a ring**
  (`HANDLE_MAX_SHARE`). The first because a dropped handle is a ring that has stopped being
  proportional with nothing on screen saying so, which is the one outcome this exists to
  prevent; the second because handles are a fixed size and a ring is not, so twenty folded
  siblings would otherwise spend the whole span on marks for things nobody wants to see.
- **The map says which files need their functions, because the window cannot know.**
  `onWantRings` reports the files whose wedge can hold a tiling, by the same test that draws
  one. It replaces a share of the focused subtree's lines (`0.0025`) standing in for that
  question — a stand-in that is right on a small repo and refuses **every file in kibana**,
  where a quarter of a per cent is ten thousand lines. The outer band was empty there for
  that reason alone, at any ring count. The share stays as the opening guess, because it
  needs no picture to have been drawn yet.

