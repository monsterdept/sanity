import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/** Mirrors `model.rs`. Kept hand-written rather than generated: the shapes are small,
 *  and the comments explaining what each number *means* are the part worth having. */
export type NodeKind = 'dir' | 'file' | 'func'
export type Provenance = 'none' | 'source' | 'history' | 'human'

/** What this build can do with one language — see `parse::LangSupport`.
 *
 *  Three different claims rather than one at three strengths: a grammar that finds functions
 *  may not resolve calls, and one that resolves calls may have no branch table. 63 read, 57
 *  resolve calls, 30 count branches — and those are pinned by a test, because the first two
 *  were quoted from a grep and both were wrong. */
export interface LangSupport {
  /** What a person calls it — `C++`, not `cpp`. */
  name: string
  extensions: string[]
  /** Decides Callers and Reach. */
  calls: boolean
  /** Decides Complexity — see `parse::branch_kinds`. */
  branches: boolean
}

/** Every language this build reads, sorted by name.
 *
 *  A fact about the BUILD rather than about a repo, so it takes no path and is asked once. */
export function languages(): Promise<LangSupport[]> {
  return invoke<LangSupport[]>('languages')
}

/** A value per churn window — always four, in the order of `Stats.churnWindows`. */
export type ChurnWindows = [number, number, number, number]

/** Commits inside a ninety-day window at which code counts as fully churning.
 *
 *  Absolute, matching `churn::CHURN_SATURATION`. Normalizing against the repo's own busiest
 *  file is the trap that constant is written against: one generated artefact becomes the
 *  denominator and squashes everything hand-written to nothing.
 *
 *  **Here rather than in `history.ts`, because it stopped being the replay's private business.**
 *  The live map is painted from Rust's arithmetic and a replay frame from the browser's, so a
 *  second copy of this number means a repo changes colour the moment History opens — which is
 *  the split-brain `CLAUDE.md` names, and it had already happened once for blame ranks. */
const CHURN_SATURATION = 8

/** How many commits saturate a window of `days`, so the colour is a RATE and not a count.
 *
 *  The twin of `edits::saturation_for` in Rust and it has to stay the twin. `CHURN_SATURATION`
 *  is documented as "roughly a commit a week over the quarter" — a rate said as a count,
 *  because the window used to be a constant. Now that a repo picks its own, holding the count
 *  fixed would make every widening of the horizon brighten the whole map, and three of the four
 *  rungs would be changing exposure rather than asking a different question.
 *
 *  Floored at one: on a one-day window a fraction of a commit would saturate anything that
 *  moved at all, and every touched wedge would read as maximally churning. */
export function churnSaturation(days: number): number {
  return Math.max((CHURN_SATURATION * days) / 90, 1)
}

export interface Score {
  /** 0..1 — how unpredictable the body is given its name and signature. */
  surprise: number
  /** 0..1 — how much of that surprise the attached docs actually account for. */
  documented: number
  /** 0..1 — how fast this is changing, one per window in `Stats.churnWindows`.
   *
   *  Four, because the window is a live choice and the answer cannot be re-derived from one
   *  of them: a directory's is a line-weighted mean of its children's, so switching would
   *  mean re-aggregating the whole tree in Rust and sending it back. See `Score::churn`.
   *
   *  All zeroes where the timeline has not been walked, which is NOT "settled" — `Stats.churned`
   *  is where the repo says whether this was measured, once, for the lens's lock to read. */
  churn: ChurnWindows
  ageDays: number | null
  lastTouchedDays: number | null
  /** The raw count behind `churn`, one per window.
   *
   *  **It used to count a different thing on a function than on a file** — a file's was
   *  commits in the window and a function's was how many distinct commits its lines traced
   *  back to, one ramp over two quantities. Both are the same question now at both
   *  resolutions: commits that CHANGED this, inside the window, off the timeline. See
   *  `edits.rs` for why blame could never answer it. */
  commits: ChurnWindows
  /** Every commit that has ever touched this path, or `null`.
   *
   *  What a header means by "commits": a SIZE, where `commits` is a rate over a window. Null
   *  on a function, where the question needs `git log -L`, and on anything git has never seen
   *  — both print nothing rather than a zero, because a zero is a claim about the file where
   *  an absence is a fact about the repo. */
  allCommits: number | null
  provenance: Provenance
  /** How tangled this is, on the 0..1 scale the ramp paints — `[weighted, raw]`.
   *
   *  Weighted asks whether this is more complicated than its LENGTH suggests, which is the
   *  finding; raw is the cognitive count itself, against an absolute bar. Both, because the
   *  switch between them is live — see `Score::tangle` in Rust and `tangle::Bands::ramp`.
   *
   *  **`null` is "this grammar has no branch table", never "nothing branches here."** The lens
   *  paints grey on it, exactly as Callers does on a language whose calls nobody taught it. */
  tangle: [number, number] | null
  /** The raw cognitive score behind `tangle`: every fork costs one, plus one for each fork it
   *  nests inside. A function's own count; a container's is the SUM of everything under it. */
  cognitive: number | null
  /** Fraction of this node's ANALYZED lines sitting in hot code. What a
   *  directory or file wedge is colored by — see `wedgeHeat`. */
  hotShare: number
  source: 'proxy' | 'model' | 'agent'
  /** Share of this node's lines a model actually looked at. 0 means uncolored. */
  analyzedShare: number
  /** 1 when the frame under the playhead is the commit this first appeared in, decaying to
   *  0 across the flash window, and null the rest of the time.
   *
   *  **Replay only, and the only thing a replay colours** — the scan never sets it, and a
   *  live map has no use for it. Everything else in a frame is drawn at the ground: a
   *  replay has no reading to show, and every attempt to derive one from the commit stream
   *  said less than grey did. See the note on `history.ts` for what was tried. */
  appeared?: number | null
  /** The same shape for a plain edit: 1 on the commit that touched this, decaying to 0.
   *
   *  Two events and two colours, because they are not the same news and a single ramp
   *  covering both said "something happened around here" about everything. An arrival is
   *  loud and rare; an edit is quiet and constant, and drawn far dimmer for exactly that
   *  reason. Every arrival is also an edit — the brighter one wins where they are drawn.
   *
   *  Functions only. See the note beside the container roll-up in `history.ts`. */
  edited?: number | null
}

export interface Hotspot {
  /** The real tokens, with a little surrounding context. */
  text: string
  /** What the model would have written instead, most likely first. */
  expected: string[]
  /** Surprisal in bits — how badly the expectation missed. */
  bits: number
}

export interface Node {
  id: string
  name: string
  kind: NodeKind
  path: string
  loc: number
  line: number | null
  /** Last line, for functions — what lets the code view map a source line to its chunk. */
  endLine: number | null
  lang: string | null
  /** Set on a FILE node a `.sanityignore` matched. Its functions are still parsed and
   *  still drawn — what they are not is queued, or in the denominator. Inherited by the
   *  subtree the way `collect_tasks` inherits it: the flag lives on the file, and the
   *  functions under it are out of scope with it. */
  excluded: boolean
  /** How many bytes a reader would be handed for this node, and `null` where nobody knows.
   *
   *  Bytes rather than lines because every limit a reader meets is counted in tokens, and
   *  bytes are what converts. Past `READ_CEILING` no reading can be taken at all: the queue
   *  skips it, `sanity_reveal` refuses it, and the map says so rather than leaving the wedge
   *  looking merely unread — see `unreadable`.
   *
   *  `null` on a directory, which is never handed to a reader, and on a tree cached before
   *  the field existed. Both mean "no answer", never "small". */
  bytes: number | null
  /** Who last committed to this file. */
  lastAuthor: string | null
  /** Whose lines most of this body IS — blame's second reduction, and `null` without per-line
   *  blame. A different question from `lastAuthor` and frequently a different answer. */
  mainAuthor: string | null
  /** How many people's lines are standing in this body. `null` without per-line blame, never
   *  0 — which would be a claim that nobody wrote it. Not painted by any lens; it is a
   *  findings field. See `TODO.md`. */
  headcount: number | null
  /** The comment attached to this node: a function's own doc, or a FILE's module header.
   *
   *  Already on the wire — `Node::doc` has been serialised all along — and dropped here,
   *  so the browser had a file's header and could not show it. It is what the Docs lens
   *  grades on a file and what the pane prints under HEADER. */
  doc: string | null
  /** The declaration line — everything up to the body.
   *
   *  On the wire all along and dropped here, like `doc` was. It is what the Docs pane shows a
   *  comment ALONGSIDE: a doc is graded against the thing it describes, and a panel that
   *  prints the prose without the signature is showing half of what the reader was handed. */
  signature: string | null
  /** The type, trait or class this function is defined inside. A bare name is not an
   *  identity — see `owner` in Rust; the panel's neighbour lists carry it for the same
   *  reason the reader's peer list does. */
  owner: string | null
  score: Score | null
  /** Hash of this function's body — what a committed reading is checked against. */
  body: string | null
  hotspots: Hotspot[]
  /** This function's wiring, from the parse: how many functions call it, how many it calls,
   *  how many distinct neighbours that makes, and how many of them live outside its own
   *  directory.
   *
   *  **`null` means the language's call shape has never been parsed** — see
   *  `parse::call_sites` — never "nothing calls this". Those are opposite facts and the Reach
   *  lens paints them differently: an absence is gray, a genuine zero is the brightest thing
   *  on the map. Every consumer has to keep them apart, which is why the counts are nullable
   *  rather than defaulted to 0.
   *
   *  The two COUNTS travel rather than the ratio they make, so a container can sum them —
   *  see `wiringShare`. */
  callers: number | null
  /** Callers that are not this repo's own test code, or `null` where test code cannot be
   *  told apart here — see `edges::Wire::dependents`. A test is a caller and it is not a
   *  dependent, and one number cannot be both. */
  dependents: number | null
  /** Does a test call this — `null` where test code cannot be told apart at all.
   *
   *  **Three states, and the third is the point.** `false` means tests are separable here
   *  and none of this body's callers is one; `null` means nothing could classify them —
   *  C++ has no test contract, so on a repo like ceph the whole language is `null`. The two
   *  must not paint alike: one is a finding, the other is an absence.
   *
   *  Never called coverage. Coverage means the line EXECUTED, which takes an instrumented
   *  run of the suite, and nothing here runs anything. */
  underTest: boolean | null
  /** What this body IS — code, a test, generated, or vendored — and on what evidence.
   *
   *  `null` is not "code": it is nothing having placed it. On a language where test code
   *  cannot be told apart, a body might be either, and the Composition lens draws that as
   *  its own neutral rather than reporting the repo as entirely hand-written. */
  codeKind: { kind: 'code' | 'test' | 'generated' | 'vendored' | 'header'; how: 'contract' | 'reader' | 'convention' | 'parsed' } | null
  /** Is this body itself test code, and on what evidence — see `model::Testness`.
   *
   *  `how` is `contract` (the toolchain says so), `reader` (a reader read the body) or
   *  `convention` (a filename or a directory). The level travels with the answer so a panel
   *  can say which it leaned on; a bare boolean would be an estimate whose accuracy is the
   *  tool's own diligence, worn as a property of the code. */
  tested: { isTest: boolean; how: 'contract' | 'reader' | 'convention' | 'parsed' } | null
  calls: number | null
  incident: number | null
  away: number | null
  /** Functions underneath whose language resolves calls, and how many of those nothing calls.
   *  On a function itself, `1` and `0`-or-`1`.
   *
   *  **Rolled up in Rust, never walked here.** A window is handed a tree with no function
   *  nodes in it on any large repo — see `Node::slim` — so a share computed by walking down to
   *  the leaves finds nothing on exactly the projects that need the lens most. Same reason
   *  `hotShare` arrives precomputed. */
  resolvable: number | null
  orphans: number | null
  /** Of those, how many call nothing in this repo — Reach's roll-up, and the outbound twin
   *  of `orphans`. See `Node::sinks` in Rust for why it is summed there and not walked here. */
  sinks: number | null
  /** Which group of identical bodies this function belongs to, and how big that group is —
   *  see `clones.rs`. Both `null` where it has no twin AND where it is too small to compare;
   *  `comparable` is what tells those apart, and only the first is a finding. */
  cloneGroup: number | null
  cloneSize: number | null
  /** Functions underneath big enough to compare, and how many of those have a twin. Rolled
   *  up in Rust for the reason `resolvable` is. */
  comparable: number | null
  copied: number | null
  /** Set when an agent assessed this function over MCP. */
  agent?: AgentReport
  /** The reading in `agent` was made against a different body than the one here.
   *  It is kept, and shown, but it no longer colors the wedge — see
   *  `applyAgentReports`. */
  agentStale?: boolean
  /** The score before an agent's reading overwrote it.
   *
   *  Kept because reports are folded into the tree that already has earlier reports in
   *  it, so by the time a reading goes stale the proxy number it replaced is gone and
   *  there is nothing to fall back to. Today a rescan happens to supply a fresh tree
   *  first, which hides it — but that is a coincidence of ordering, not a guarantee, and
   *  the failure it hides is a wedge keeping an expired color. */
  proxyScore?: Score
  /** How many functions this FILE holds, when the tree arrived without them — see
   *  `fileFunctions`. Zero on a file whose functions are present, where `children` is the
   *  answer, and zero on everything that is not a file. */
  funcs: number
  /** Files under this node the walk could not parse — see `Node::unparsed` in `model.rs`.
   *
   *  **Optional, and its absence is the point.** A replayed frame and a scan still streaming
   *  its shape both build nodes of their own, and neither knows what the walk could not read:
   *  a frame is built from git history, where a file that has no grammar today has no entry
   *  at all. Zero would say "nothing here was unreadable", which is a confident answer nobody
   *  computed. Undefined says nothing, and the corner chip prints nothing — the same rule
   *  every lens follows when it is out of evidence.
   *
   *  **Optional also means `toNode` can forget it and the compiler will not say so**, which
   *  is how this shipped silent the first time: the field was on the interface, the wire
   *  carried the number, and nothing copied it across. Anything added here needs a line
   *  there. */
  unparsed?: number
  /** This FILE's functions, reduced to the numbers a distribution is built from — see
   *  `Cols` in `model.rs`.
   *
   *  Present on a file whose ring has not been fetched, which is most of a large repo. It is
   *  what lets a directory's rim draw what is actually underneath it rather than what the
   *  window happens to hold: the roll-up scalars (`hotShare`, `orphans`) already survive
   *  slimming, and this is the same idea for a shape rather than a mean. Never a substitute
   *  for the ring — a fetched ring carries everything, and `histogramsFor` prefers it. */
  /** Readings for this FILE's functions, when the ring holding them has not been fetched.
   *
   *  The reading lenses fold from function NODES, and a large repo arrives without any — so
   *  a directory's breakdown under Legibility or Docs was built from whichever files
   *  happened to have been asked for. `Cols` cannot close this one: a grade is not a number
   *  the scan knows, it comes from `.sanity/` and is folded in the browser.
   *
   *  So the reports themselves ride on the file, carrying the two things the window cannot
   *  work out without the function — its lines, and whether the reading has expired. See
   *  `Report::loc` in `agentapi.rs`. */
  pending?: AgentReport[]
  cols?: Cols
  /** How many functions this node stands in for, on the synthetic wedge a band draws when
   *  it runs out of room. Undefined on everything else, which is what makes it the test
   *  for "this is a collection wearing a function's `kind`" — see `showsShare`. */
  rest?: number
  /** What a roll-up STANDS FOR, by value — the summary that keeps a folded wedge in the
   *  distribution instead of out of it.
   *
   *  **A replay folds most of a frame away, and the fold used to destroy the answer.** Files
   *  too thin to draw become one stand-in per directory carrying their combined lines and
   *  nothing else, so a rim built from what was left described a sample and called it the
   *  whole: ceph's `src/pybind` is 71% Python and 29% TypeScript, and the replay drew it as
   *  100% TypeScript over 517 of its 195,516 lines. Counting those lines as an ABSENCE was
   *  worse still — it said the history was missing when it was merely not materialised.
   *
   *  So the fold carries a tally of what it dropped. Per FILE rather than per function, which
   *  is the resolution a file already answers at when its ring has not arrived — its author
   *  and its language are its own — and one the live map makes the same way. Only the
   *  categorical lenses for now: a language and an author are facts about a file, where an age
   *  or a churn band is a fact about a function and the frame does not carry per-file dates.
   *  Those lenses keep saying nothing about a roll-up, which is the honest half of the old
   *  behaviour without the label that was the dishonest half. */
  folded?: Folded
  /** Does anything in this subtree flash on this frame of a replay — see `history.ts`'s
   *  `aggregate`, which rolls it up, and `Sunburst`, which spends it.
   *
   *  A container's own `appeared`/`edited` is deliberately NOT a roll-up: a directory
   *  flashes on its own arrival and never on its contents', or one function lights every
   *  ring out to the rim. This is the different question the renderer has to ask — is
   *  there an event down there that nothing DRAWN is going to show — and it is answered
   *  here because `aggregate` already walks every node, where the renderer would be
   *  walking a second time thirty times a second. Undefined outside a replay. */
  birthBelow?: boolean
  touchBelow?: boolean
  children: Node[]
}

/**
 * Does this wedge report a SHARE rather than a temperature?
 *
 * The two are on one color ramp and are not comparable, so which one a wedge is showing
 * has to be decided in exactly one place. It used to be decided as `kind === 'func'` in
 * four, and the overflow aggregate — a stand-in for hundreds of functions, drawn at the
 * size of a container — fell on the function side of it. So the only large objects on the
 * screen painting a temperature were the roll-ups, every real container sat near the cold
 * end of a share scale, and the map read hot exactly where it was least entitled to: that
 * pool holds what is left after the hottest members were drawn separately, so its
 * temperature is bounded by the coldest wedge beside it and says more about where the
 * truncation fell than about the code.
 */
/**
 * The tree with everything `.sanityignore` set aside taken out of it.
 *
 * **Ignored means ignored.** An excluded file used to be drawn and merely left out of the
 * queue and the denominator, on the argument that an exclusion nobody can see is how a map
 * claims completeness over a subset. The counting half of that argument survives — Rust walks
 * its own tree, which still holds them, and every place either number appears still says
 * `functions` and `excluded` together. What does not survive is the drawing: somebody who has
 * written a file saying "this is not my code" is not asking for it to be the largest wedge on
 * screen.
 *
 * Sizes are recomputed on the way out. A directory's `loc` came from Rust with its excluded
 * children counted in, and a parent whose children no longer fill it lays out as a ring with a
 * gap in it — the arcs are drawn from the sizes, not from the shape.
 *
 * Files, never functions: exclusion is a property of a path, and it is inherited. A function
 * carries its file's flag, so testing it per node would be testing the same fact twice.
 */
export function pruneExcluded(node: Node): Node {
  if (node.kind === 'func') return node
  let moved = false
  const children: Node[] = []
  for (const c of node.children) {
    if (c.excluded) {
      moved = true
      continue
    }
    const kept = pruneExcluded(c)
    if (kept !== c) moved = true
    children.push(kept)
  }
  const loc = node.kind === 'file' ? node.loc : children.reduce((t, c) => t + c.loc, 0)
  // **The same node back when nothing was set aside underneath it.** It used to clone every
  // node it walked, which made the whole tree new every time it ran — and it runs off the
  // scan's identity, which a landed reading changes twice a minute. So one function going
  // from grey to hot handed the map, the panel and every percentile table a tree whose every
  // node was a different object, and each of their memos rebuilt everything: a redraw of the
  // repo to carry a change to one wedge. Same rule `readIntoRing` and `filled`'s graft
  // follow — a node is a new object exactly when it means something new.
  //
  // `loc` is compared as well as the children, rather than trusted: a directory's size
  // arrives from Rust with its excluded children counted in, so a subtree can prune to the
  // same shape and a different size.
  if (!moved && loc === node.loc) return node
  return { ...node, children, loc }
}

/** A node's locality — the share of the wiring underneath it that leaves its own directory.
 *
 *  One formula at every scope. At a function it is that function's own neighbours; above it,
 *  Rust's `aggregate` has already summed the two counts, which is why the COUNTS cross the
 *  wire and not the ratio they make.
 *
 *  The single accessor, on the same rule `legibleOf` follows: the lens, the panel row and the
 *  breakdown all need this number, and three copies of one division is three chances for the
 *  map and the list beside it to disagree about the same wedge.
 *
 *  `null` on anything nothing is wired to. Zero would say "everything it touches is next
 *  door" — the calmest reading on the ramp — about a function that touches nothing, which has
 *  not earned it. That case is Reach's subject, not this one's. */
export function localityOf(n: Node): number | null {
  if (n.incident == null || n.away == null || n.incident === 0) return null
  return n.away / n.incident
}

/** A file's functions as parallel arrays. Absences are `-1`, never `null`, so each column
 *  stays a flat array of numbers on the wire — see `Cols` in `model.rs` for what each one
 *  holds and which absence it encodes. */
/** One roll-up's contents, by value and by lines — see `Node.folded`.
 *
 *  Pairs rather than a `Map` because these are rebuilt every frame and read once: a map's
 *  allocation per stand-in, per frame, is the cost the fold was rewritten twice to avoid. */
export interface Folded {
  /** Lines by language, for the Language lens. */
  lang: [string, number][]
  /** Lines by last author, for Blame. `null` keys — a file git has never seen — are left out
   *  rather than folded into a name, the same way the live walk treats them. */
  author: [string, number][]
  /** Lines by what the body is, for Composition. Totalled per FUNCTION and carried per file,
   *  because a file is a mix — Rust keeps its tests beside the code they test. `unplaced` is a
   *  body nothing placed, which the live map draws in the same neutral. */
  kind: [string, number][]
  /** Age and Churn, as flat runs of `TIME_STRIDE` numbers — `TimeRow`, one per folded FILE.
   *
   *  The churn ramp rides along rather than being derived where it is read: it is
   *  `commits / CHURN_SATURATION`, and that saturation is the REPLAY's own — see `scoreInto`,
   *  which builds a drawn function's score from the same number. Recomputing it in
   *  `colorMode` would be a second copy of a constant that has already moved once.
   *
   *  **Raw rather than banded, because the bands are not the fold's to decide.** A band is
   *  `colorMode`'s answer and a ramp needs the repo's age span, which the fold has never
   *  heard of; totalling into bands here would put a second copy of `AGE_BANDS` in the one
   *  place nobody would think to look when the first copy moved. So the fold reports what it
   *  measured and `contribute` bands it exactly as it bands a function.
   *
   *  Flat, not tuples: one array of numbers per stand-in rather than a thousand two-element
   *  arrays, on a structure rebuilt every frame. `-1` days is a file the replayed window never
   *  saw touched, which lands in the absence bucket the same way an undated function does —
   *  the window's own doctrine, that nothing before it makes a claim about its age. */
  time: number[]
  /** Complexity, as flat runs of `TANGLE_STRIDE` numbers — `TangleRow`, one per folded FILE.
   *
   *  Banded by `contribute` calling itself, exactly as `time` is and for the same reason: a
   *  folded file and a drawn one must not fall in different bands. What is carried is the
   *  file's own answer — the LOC-weighted mean of its functions' ramp positions, and the SUM
   *  of their counts — which is what `Node::aggregate` computes for a file on the live map.
   *
   *  A file whose language nobody has taught the parser carries `-1` and lands in the same
   *  absence the live map draws in the structural neutral. Not dropped: its LINES are real,
   *  and a roll-up that quietly shed them would report a directory as smaller than it is. */
  tangle: number[]
}

/** How many numbers `Folded.time` spends per file.
 *
 *  **A name rather than a literal, because it has changed and the two ends of it live in
 *  different files.** It was four; Age's second reading needed the birth date and made it
 *  five, and the writer (`history.ts`) and the reader (`colorMode.ts`) each had the stride
 *  written into a loop. A run-length mismatch here does not throw — it reads the next file's
 *  touch date as this one's line count and bands the frame out of numbers that are all real
 *  and all in the wrong slots, which is exactly the class of wrongness this app is built to
 *  refuse to ship quietly. */
/** One folded file's answer to Age and Churn.
 *
 *  **The churn RAMP no longer rides along, and that is a change of ownership rather than a
 *  saving.** It used to, on the argument that deriving `commits / CHURN_SATURATION` where it is
 *  read would put a second copy of a constant in `colorMode` — true while the constant was the
 *  replay's private business. It is `api.ts`'s now (`churnSaturation`), shared by the live map
 *  and the frame, because a repo picks its own windows and the two halves must not disagree
 *  about what saturates one. With one owner, deriving at read time is the single-source
 *  version, and the row carries four counts instead of a count and a ramp.
 *
 *  `-1` for either date means the replayed window never saw it: never touched, or never seen to
 *  arrive. Both are undated rather than dropped — see `contribute`. */
export type TimeRow = [
  touched: number,
  born: number,
  lines: number,
  commits30: number,
  commits60: number,
  commits90: number,
  commits180: number,
]
export const TIME_STRIDE: TimeRow['length'] = 7

/** One folded file's answer to Complexity.
 *
 *  `weighted` and `raw` are ramp positions, already on the 0..1 scale — the file's own
 *  LOC-weighted mean, which is the number the live map's file wedge carries. `cognitive` is
 *  the SUM under the file, because a container's complexity is how many decisions are in it.
 *
 *  All three are `-1` where nothing in the file could be counted. */
export type TangleRow = [lines: number, weighted: number, raw: number, cognitive: number]
export const TANGLE_STRIDE: TangleRow['length'] = 4

export interface Cols {
  loc: number[]
  commits: ChurnWindows[]
  /** `Score.tangle` per function, as `[weighted, raw]` in thousandths — `[-1, -1]` where the
   *  language has no branch table. Integers because it is a wire format; the absence is the
   *  same sentinel every other column here uses, and a zero would read as "never forks". */
  tangle: [number, number][]
  touched: number[]
  callers: number[]
  /** What the Composition lens paints, per function: `0` code, `1` test, `2` generated,
   *  `3` vendored, `-1` nothing could place it.
   *
   *  Carried so a FILE can stand in for functions the window was never sent. Rings arrive
   *  only for files wide enough to draw an inside, so at a repo's root most files have none,
   *  and a histogram over the ones that happened to arrive is a confident picture of a
   *  biased sample. */
  kind: number[]
  calls: number[]
  clones: number[]
}

export function showsShare(node: Node): boolean {
  return node.kind !== 'func' || node.rest !== undefined
}

export interface ScanStats {
  filesScanned: number
  filesSkipped: number
  functions: number
  /** No git history, so age and churn are absent and any read of WHY something is
   *  surprising is half a verdict.
   *
   *  Nothing in the window says so any more. It used to be a banner, and the banner was
   *  the problem: it explained the four quadrants to somebody who has never been shown
   *  them, in the vocabulary of the enum — "the stability axis is off", "a crown jewel or
   *  a mess". A caveat that has to teach two concepts before it can be understood is not a
   *  caveat, and rewriting it plainly only made it a longer thing to skip. The lenses it
   *  affects are the honest place to say it, if anywhere does: Age and Churn have nothing
   *  to draw on such a repo and can say so where the question is actually being asked.
   *
   *  Kept on the wire because `just scan` still reports it, where the reader is us. */
  withoutHistory: boolean
  /** Call sites that reached a definition in this repo, and ones that did not. The diagnostic
   *  behind the two wiring lenses — most calls in any real file go to a dependency, so a low
   *  share is normal, but a repo near zero means the resolver is wrong and both lenses are
   *  noise. Optional because a scan taken by an older backend does not carry them. */
  callsResolved?: number
  callsUnresolved?: number
  /** Commits reachable from HEAD. 0 when there is no history — the header reads that as
   *  "say nothing" rather than as a repo with no commits. */
  commits: number
  /** The four churn windows THIS repo offers, in days — see `edits::windows_for`.
   *
   *  Not a constant: a fixed 30/60/90/180 goes inert on a young repo, where all four return
   *  the same count. So the ladder scales to a repo that cannot fill it, and every caption
   *  naming a window has to name it from here. */
  churnWindows: ChurnWindows
  /** Whether the timeline has been walked, so `Score.churn` and `Score.commits` are
   *  measurements rather than zeroes.
   *
   *  **The absence, stated once.** Until it is true the lens is locked and paints nothing:
   *  zero is not "settled", and a lens that drew it would report an unwalked repo and a quiet
   *  one in the same colour. Read in one place — the lock — never per node. */
  churned: boolean
  /** What a normal cognitive score is for a body of each size, in THIS repo — one median per
   *  size band, `null` for a band nothing landed in. See `tangle::Bands`.
   *
   *  Sent so the panel and the tooltip can name what a wedge is being compared against:
   *  "three times normal for its size" is checkable, a ramp position is not. Empty locks the
   *  Complexity lens — it means no language here has a branch table. */
  tangleBands: (number | null)[]
  /** The shortest and longest body each band's median was actually measured over — see
   *  `tangle::Bands::over`.
   *
   *  **Not derivable from the band's own edges**, which is the only reason it crosses the
   *  wire. A band too thin to have an opinion borrows the population of the one below it, so
   *  in a small repo the 1600+ band is measured over everything past 199 — and a caption
   *  reading `typical for repo (1600+ lines)` would name a population that was never used.
   *  A lens that shows its work has to show the right work. */
  tangleOver: ([number, number] | null)[]
  /** Everyone who has committed here, most commits first, capped at what the palette holds.
   *
   *  **This is the only thing that decides a person's colour.** Ranking authors by what they
   *  hold in the view made the colour a property of the view: it changed when you drilled and
   *  it changed frame to frame in a replay, so Blame animated its own ranking. One list per
   *  repo means one colour per person — the live map and every frame of its history agree.
   *
   *  Empty from a backend that predates the field, where the window falls back to ranking
   *  what is on screen: the old behaviour, which was wrong in a way somebody can see rather
   *  than a blank map. */
  authors: string[]
  model: string
}

export interface Scan {
  root: Node
  stats: ScanStats
}

export interface Progress {
  done: number
  total: number
  /** What is being done — see `Progress::phase` in Rust. Present whether or not there is
   *  a count, because a bar that runs several phases at very different speeds reads as a
   *  hang at each join unless the join is named. */
  phase?: string
  /** What `done` and `total` are counting, plural — see `Progress::unit` in Rust. The
   *  window must not supply this itself: it printed `functions` over a file count for
   *  every phase that has actually run since the model pass was removed. */
  unit?: string
  /** Repo-relative path this tick is about, so the map can light the wedge — see
   *  `Progress::at` in Rust. Empty for phases with no single subject. */
  at?: string
  /** Which sub-step of a multi-step phase this tick belongs to, 1-based — see
   *  `Progress::step` in Rust, and `Phase.fill` for the chambers it fills.
   *
   *  A number rather than the phase string, which the window could have matched on instead and
   *  which would have worked until somebody reworded a heading. Absent from an older backend,
   *  and the reader must have an answer for that rather than a branch that falls through: a
   *  trace with no step is the log walk, which is the only step that can report without a
   *  denominator. */
  step?: number
}

/** Serde renames these to snake_case on the wire; Tauri does not convert for us. */
export interface WireScore {
  surprise: number
  documented: number
  churn: ChurnWindows
  age_days: number | null
  commits: ChurnWindows
  tangle?: [number, number] | null
  cognitive?: number | null
  /** Optional because a scan taken by an older backend does not carry it — see
   *  `Score.allCommits`, where the absence and a zero are different answers. */
  all_commits?: number | null
  last_touched_days: number | null
  provenance: Provenance
  hot_share: number
  source: 'proxy' | 'model' | 'agent'
  analyzed_share: number
}
export interface WireNode {
  cols?: Cols
  id: string
  name: string
  kind: NodeKind
  path: string
  loc: number
  line?: number | null
  lang: string | null
  end_line?: number | null
  bytes?: number | null
  excluded?: boolean
  last_author: string | null
  main_author?: string | null
  headcount?: number | null
  unparsed?: number
  doc?: string | null
  signature?: string | null
  owner?: string | null
  body: string | null
  score: WireScore | null
  hotspots?: Hotspot[]
  /** Optional because a scan taken by an older backend does not carry them, and the absence
   *  has to arrive as `null` rather than 0 — see `Node.callers`. */
  callers?: number | null
  /** Callers that are not test code, absent where test code cannot be told apart. */
  dependents?: number | null
  /** Does a test call this — absent where nothing can classify test code here. Three
   *  states, and `null` is not `false`: see `Node.underTest`. */
  under_test?: boolean | null
  /** Is this body itself test code, and on what evidence — `model::Testness`. */
  tested?: { is_test: boolean; how: 'contract' | 'reader' | 'convention' | 'parsed' } | null
  /** What this body is — see `Node.codeKind`. */
  code_kind?: { kind: 'code' | 'test' | 'generated' | 'vendored' | 'header'; how: 'contract' | 'reader' | 'convention' | 'parsed' } | null
  calls?: number | null
  incident?: number | null
  away?: number | null
  resolvable?: number | null
  orphans?: number | null
  sinks?: number | null
  clone_group?: number | null
  clone_size?: number | null
  comparable?: number | null
  copied?: number | null
  /** Absent rather than empty for a function — see the `skip_serializing_if` on `Node` in
   *  Rust. A hundred thousand `"children":[]` is megabytes of nothing. */
  children?: WireNode[]
  funcs?: number
}
export interface WireScan {
  root: WireNode
  stats: {
    files_scanned: number
    files_skipped: number
    functions: number
    without_history: boolean
    commits?: number
    churn_windows?: ChurnWindows
    churned?: boolean
    tangle_bands?: {
      median: (number | null)[]
      over?: ([number, number] | null)[]
    }
    authors?: string[]
    model: string
    calls_resolved?: number
    calls_unresolved?: number
  }
}

/** The extent above which no reading can be taken — `agentapi::READ_CEILING`.
 *
 *  **Duplicated from Rust on purpose, and the two have to move together**, the way
 *  `MINIFIED_LINE_BYTES` and `VENDORED` are duplicated into `history.rs`. The alternative is
 *  a round trip to be told a constant, on every wedge, to answer a question the browser
 *  already has the number for. If they drift, the map offers work the queue will not hand
 *  out — or marks as unreadable something a reader is at that moment reading.
 */
export const READ_CEILING = 524_288

/** Too large for a reading to be taken over it at all.
 *
 *  One helper so the wedge, the tooltip and the panel cannot disagree — the same reason
 *  `legibleOf` exists. An unknown extent is READABLE: `null` is a directory or a tree cached
 *  before the field existed, and treating that as "too large" would grey out a whole repo
 *  and call it a finding.
 */
export function unreadable(node: { bytes: number | null }): boolean {
  return node.bytes !== null && node.bytes > READ_CEILING
}

/** A node off the wire. Exported for the headless renderer, which reads the same JSON. */
export function toNode(w: WireNode): Node {
  return {
    id: w.id,
    name: w.name,
    kind: w.kind,
    path: w.path,
    loc: w.loc,
    line: w.line ?? null,
    endLine: w.end_line ?? null,
    // **`?? null` and never `?? false`.** All three carry an absence that is not a zero:
    // `underTest` null means test code cannot be told apart in this language, which the
    // Testing lens draws as its own neutral rather than as "no test calls this".
    dependents: w.dependents ?? null,
    underTest: w.under_test ?? null,
    tested: w.tested ? { isTest: w.tested.is_test, how: w.tested.how } : null,
    codeKind: w.code_kind ?? null,
    bytes: w.bytes ?? null,
    lang: w.lang ?? null,
    excluded: w.excluded ?? false,
    lastAuthor: w.last_author ?? null,
    mainAuthor: w.main_author ?? null,
    headcount: w.headcount ?? null,
    doc: w.doc ?? null,
    signature: w.signature ?? null,
    owner: w.owner ?? null,
    body: w.body ?? null,
    score: w.score
      ? {
          surprise: w.score.surprise,
          documented: w.score.documented,
          churn: w.score.churn,
          ageDays: w.score.age_days,
          commits: w.score.commits,
          allCommits: w.score.all_commits ?? null,
          lastTouchedDays: w.score.last_touched_days,
          // `?? null` and never `?? 0`, for the reason every absence here follows: a backend
          // that predates the lens and a language nobody wrote branch kinds for are the same
          // fact — nobody looked — and a zero would paint both as code that never forks.
          tangle: w.score.tangle ?? null,
          cognitive: w.score.cognitive ?? null,
          provenance: w.score.provenance,
          hotShare: w.score.hot_share,
          source: w.score.source,
          analyzedShare: w.score.analyzed_share,
        }
      : null,
    hotspots: w.hotspots ?? [],
    // `?? null`, never `?? 0`. A backend that has never heard of the call graph and a repo
    // in a language whose calls do not resolve are the same fact here — nobody looked — and
    // a zero would paint both as "nothing calls this", which is the finding the lens exists
    // to make.
    callers: w.callers ?? null,
    calls: w.calls ?? null,
    incident: w.incident ?? null,
    away: w.away ?? null,
    resolvable: w.resolvable ?? null,
    orphans: w.orphans ?? null,
    sinks: w.sinks ?? null,
    cloneGroup: w.clone_group ?? null,
    cloneSize: w.clone_size ?? null,
    comparable: w.comparable ?? null,
    copied: w.copied ?? null,
    children: (w.children ?? []).map(toNode),
    funcs: w.funcs ?? 0,
    // `?? undefined`, never `?? 0`: a backend that predates this field has not measured what
    // it could not parse, and a zero would report that silence as a repo with no gaps. Same
    // rule as `callers` above, and the same reason.
    unparsed: w.unparsed ?? undefined,
    // Undefined rather than an empty `Cols`, so "this build sent none" and "this file has no
    // functions" stay apart — `histogramsFor` refuses to draw a distribution over a subtree
    // it cannot account for, and an empty column set would read as a file with nothing in it.
    cols: w.cols ?? undefined,
  }
}

export interface AgentCall {
  seq: number
  tool: string
}

export interface AgentActivity {
  active: boolean
  tool: string
  nonce: number
  /** The last few calls, oldest first. The poll is slower than a working reader, so a
   *  single tool name would show whichever call happened to land last and lose the rest. */
  events: AgentCall[]
}

/** Is an agent driving sanity right now? Polled so the sidebar can say so — and, just as
 *  importantly, say when nothing is. */
export function agentActivity(): Promise<AgentActivity> {
  return invoke<AgentActivity>('agent_activity').catch(() => ({
    active: false,
    tool: '',
    nonce: 0,
    events: [],
  }))
}

/** Pick a repo and hand it to Sanity.
 *
 *  Resolves to the chosen path, or null if the picker was dismissed. Rejects with a
 *  sentence to show when the directory is not a single repo — see `add_project`, which
 *  refuses a folder holding several rather than scanning all of them. */
/** Ask for a folder to add.
 *
 *  **A macOS bug lives here, diagnosed and not yet worked around.** In the open panel's LIST
 *  view — the one with disclosure triangles — a double-click on a folder is consumed as
 *  "toggle disclosure": it expands the row in place instead of descending, and clears the
 *  selection doing it. The panel's confirm path then runs against that state, finds no
 *  selection, and a directories-only panel with no selection answers with the folder you are
 *  browsing. So double-clicking `wormhole` inside `~/projects` hands over `~/projects`. It is
 *  not returning the wrong choice; it is returning NO choice, and the fallback is the parent.
 *
 *  Measured, in a standalone AppKit binary with no Tauri and no `rfd`, by printing the view
 *  mode the panel persists: mode 2 (list) returns the parent, while mode 1 (icon) and mode 3
 *  (column) both return the folder that was double-clicked. Same binary, same gesture, one
 *  variable — and only the view that HAS disclosure triangles is affected, which is what
 *  makes the toggle the likely culprit. On a macOS public beta, so it may be a regression
 *  rather than long-standing behavior.
 *
 *  Deliberately not worked around here. A delegate that refused non-repos "fixed" it by
 *  making the wrong answer invalid, which is a folder filter wearing a bug fix's clothes —
 *  and it cost a filesystem probe per visible row, which made the panel lag. The honest fix
 *  is to open the panel in a mode that has no disclosure triangles, which means writing this
 *  app's `NSNavPanelFileListModeForOpenMode` default and overriding a preference the user
 *  may have set on purpose. That is a decision, not a patch, so it waits.
 *
 *  Single-click and Open returns the right folder in every mode. That is the interaction
 *  until then. */
/** A chosen folder, and whether it is a pile of other people's repos. */
export interface Added {
  path: string
  /** The key the backend will file this repo under — see `add_project`. Matching on it
   *  rather than on `path` is what makes "select the repo I just added" exact. */
  key: string
  /** Git repos directly inside it. Zero for an ordinary project. */
  holds: number
  /** The first few, so a warning can name them. */
  names: string[]
}

export async function pickProject(): Promise<Added | null> {
  const { open } = await import('@tauri-apps/plugin-dialog')
  const picked = await open({ directory: true, multiple: false, title: 'Add a folder' })
  if (typeof picked !== 'string') return null
  return invoke<Added>('add_project', { path: picked })
}

/** Ask where an exported replay should go, and write it there.
 *
 *  Resolves to the path written, or `null` if the save dialog was dismissed — which is a
 *  choice rather than a failure and must not read as one.
 *
 *  The bytes travel base64: a movie is tens of megabytes and the IPC's other shape for a
 *  byte array is a JSON array of numbers, which is four characters a byte. The write itself
 *  is Rust's because this is the only path on which the app writes anything at all, and it
 *  is worth having that in one place that can check what it was handed. */
export async function saveMovie(bytes: Uint8Array, suggested: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    defaultPath: suggested,
    filters: [{ name: 'Movie', extensions: ['mp4'] }],
    title: 'Save the replay',
  })
  if (typeof path !== 'string') return null
  const { encoded } = await import('./movie')
  await invoke('save_movie', { path, data: encoded(bytes) })
  return path
}

/** Ask where an exported report should go, and write it there — `saveMovie`'s twin, with the
 *  same `null` for a dismissed dialog and the same base64 for the same reason. */
export async function savePdf(bytes: Uint8Array, suggested: string): Promise<string | null> {
  const { save } = await import('@tauri-apps/plugin-dialog')
  const path = await save({
    defaultPath: suggested,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
    title: 'Save the report',
  })
  if (typeof path !== 'string') return null
  const { encoded } = await import('./movie')
  await invoke('save_pdf', { path, data: encoded(bytes) })
  return path
}

/** Put `sanity` on the PATH — a symlink into /usr/local/bin or ~/.local/bin.
 *
 *  Only needed for a direct download; the Homebrew cask links it for you. Resolves to
 *  where it went and whether that directory is visible from here — which is a weaker
 *  claim than it sounds, since a GUI app's PATH is not the user's. */
export function installCli(): Promise<{ path: string; on_path: boolean }> {
  return invoke<{ path: string; on_path: boolean }>('install_cli')
}

/** Which coding agents are installed. The app's real prerequisite now that it runs the
 *  readers itself — and, unlike "configure an MCP server", something we can just look for. */
export interface ModelChoice {
  /** What goes on the command line. */
  id: string
  /** What the harness calls it. Equal to `id` where there is nothing better. */
  label: string
  /** The harness's own default. Shown, never auto-selected. */
  default: boolean
}

export interface HarnessInfo {
  id: string
  installed: boolean
  /** Models the harness names for itself. Empty is a real answer — the app server may not
   *  answer, or the agent may not be installed — and the picker degrades to a text field. */
  models: ModelChoice[]
  /** True when `models` is the agent's own catalog rather than aliases we wrote down.
   *
   *  Only Claude Code is false: it publishes nothing a program can read, so its four
   *  entries name families and a full version has to be typed. The other three enumerate
   *  real ids, where a text field would only let somebody type one that gets rejected at
   *  spawn time. */
  enumerated: boolean
}

/** Cumulative lines the queue will have handed out, one entry per ten functions.
 *
 *  Why a lookup and not a multiplication: a partial run reads the functions the queue picks,
 *  in the order it picks them, and those are not average-sized. Apportioning by count would
 *  make the lines figure a restatement of the function count, and the two bars in the Read
 *  dialog would paint identically. Empty when the project is unknown or fully read. */
export function readCurve(key: string): Promise<number[]> {
  return invoke<number[]>('read_curve', { key }).catch(() => [])
}

/** Take a project out of the sidebar. Not a delete: the repo and its committed readings
 *  are untouched, and re-adding it restores everything it knew. */
/** Remember that this project is the one being looked at, so a restart comes back to it. */
export function selectProject(key: string): Promise<void> {
  return invoke<void>('select_project', { key })
}

/** Put the sidebar in this order and remember it — see `reorder_projects`. */
export function reorderProjects(keys: string[]): Promise<void> {
  return invoke<void>('reorder_projects', { keys })
}

export function forgetProject(key: string): Promise<void> {
  return invoke<void>('forget_project', { key })
}

/** Throw away everything derived for this repo — the tree, the scan log, the blame and the
 *  timeline — and keep its readings, which live in `.sanity/` and are not ours to delete.
 *  See `reset_project`, which carries the argument. */
export function resetProject(key: string): Promise<void> {
  return invoke<void>('reset_project', { key })
}

export function harnesses(): Promise<HarnessInfo[]> {
  return invoke<HarnessInfo[]>('harnesses').catch(() => [])
}

/** Record who reads a project. Once per project — see `ProjectSummary.harness`. */
export function setReader(
  key: string,
  harness: string | null,
  model: string | null,
): Promise<void> {
  return invoke<void>('set_reader', { key, harness, model })
}

/** Start a wave. Resolves to the backend's own answer, including its refusals — a missing
 *  agent or a run already going are sentences worth showing, not exceptions. */
export function startCheck(
  key: string,
  opts: {
    model?: string | null
    readers?: number | null
    /** How many functions each reader takes. Fewer is faster and dearer — see `Run.batch`. */
    batch?: number | null
    limit?: number | null
  } = {},
): Promise<{ ok: boolean; error?: string; hint?: string; harness?: string }> {
  return invoke('start_check', {
    key,
    model: opts.model ?? null,
    readers: opts.readers ?? null,
    batch: opts.batch ?? null,
    limit: opts.limit ?? null,
  })
}

/** Ask a wave to stop. Honored between readers, never mid-reading. */
/** Stop a running scan. What it parsed is kept in the scan cache, so the next attempt picks up
 *  where this one stopped; the tree is not — a half-parsed tree is a wrong map, not a small
 *  one, so a stopped scan leaves the map that was there before it. */
export function stopScan(): Promise<void> {
  return invoke<void>('stop_scan')
}

export function stopCheck(key: string): Promise<void> {
  return invoke<void>('stop_check', { key })
}

/** How much there is to read in a project: its functions AND its files.
 *
 *  One helper because the sum is a claim, and three call sites each adding two fields is
 *  three places for it to stop agreeing. A file is queued, leased, reported and expired
 *  exactly as a function is, so a bar that divided by functions alone could fill to 100%
 *  with sixty-two file readings outstanding — the same failure as counting leased work
 *  as done. */
export function readable(p: ProjectSummary): number {
  return p.functions + p.files
}

/** What the next depth of history would cost, as the backend priced it.
 *
 *  Seconds are an ESTIMATE, and `cold` says whether anything measured this repo: one nobody
 *  has walked here is priced from its packed object count against a corpus ratio, which is
 *  free and approximate. Printing that as though somebody had timed it would be the
 *  instrument claiming a confidence it has not got. */
export interface TraceCost {
  seconds: number
  commits: number | null
  cold: boolean
  fits: boolean
}

/** What reading a repo's history would cost, before it has been added — see `estimateTrace`. */
/** Stop a running trace. What it read is kept — depth 1 is whole or not at all, and a stopped
 *  depth 2 leaves the files it reached resolved and the rest on their file's numbers. */
export function stopTrace(path: string): Promise<boolean> {
  return invoke<boolean>('stop_trace', { path })
}

export function estimateTrace(path: string): Promise<TraceCost> {
  return invoke<TraceCost>('estimate_trace', { path })
}

/** Does the add dialog explain what a scan and a trace are? Machine-local, and it hides the
 *  explanation rather than the choice — a repo over budget still arrives with its history
 *  unread either way, which is what makes the checkbox safe to tick. */
export function explainTrace(): Promise<boolean> {
  return invoke<boolean>('explain_trace')
}

export function setExplainTrace(explain: boolean): Promise<void> {
  return invoke('set_explain_trace', { explain })
}

/** What a scan would cost, as the backend priced it from the last one's rate. */
export interface ScanCost {
  seconds: number
  files: number | null
  cold: boolean
  fits: boolean
}

export interface ProjectSummary {
  key: string
  name: string
  repo: string
  functions: number
  /** Files that are their own reading — see `count_files` in Rust. The coverage
   *  denominator is `functions + files`, because both are queued, reported and expired the
   *  same way; `functions` alone let the bar fill while file readings were outstanding. */
  files: number
  /** Which scan this is, counting up. Moves when the repo did — an edit, a commit, a pull.
   *
   *  The map was a photograph nobody re-took: the window fetched a tree when the ACTIVE
   *  project changed and never again, so committing left Blame reporting lines as
   *  uncommitted forever. Comparing this is how the poll knows to fetch a new one. */
  scanned: number
  /** Functions whose reading still describes them. Stale ones are NOT counted — a
   *  project cannot be finished and hold expired readings. */
  assessed: number
  /** Readings whose code has changed since. Already excluded from `assessed`. */
  stale: number
  /** Node ids out with a reader right now — the map pulses them, so a run reads as a
   *  sweep across the repo rather than as a list of names scrolling past.
   *
   *  Safe to key on node ids only because nothing here is stored: it is one frame of the
   *  poll, matched against a tree from the same process. Anything durable uses `key_of`. */
  reading: string[]
  /** Lines of code in the functions still outstanding. The size of the job in the unit the
   *  map is drawn in — a count says how many things, this says how much code. */
  unread_lines: number
  /** Commits reachable from HEAD, as the scan counted them. 0 for a repo with no history. */
  commits: number
  /** Commits already replayed and stored. `commits - replayed` is the story left to read. */
  replayed: number
  /** Where this repo's trace has got to, when one is running — from the process doing it.
   *
   *  **The window is not the owner of a walk and cannot be trusted to remember one.** This
   *  was React state, so a reload — every save under `just dev` — left a running trace
   *  invisible: the row offered `Trace` again over a repo already using ten cores, and the
   *  count beside it froze. Backend-reported, so a reloaded window, a second window and a
   *  headless `serve` all say the same thing. Null when nothing is walking it. */
  tracing: Progress | null
  /** How much of this repo's history the MAP holds — see `trace::Depth` in Rust.
   *
   *  `untraced` means the wedges carry no age, churn or author at all. That is NOT the same
   *  sentence as "this folder has no git history", and the two must never render alike: one
   *  is a fact about the repo, the other is work nobody has paid for yet. */
  trace_depth: 'untraced' | 'files' | 'lines' | 'edits'
  /** What reading more of it would cost, when that is more than the budget spends unasked.
   *
   *  Present means the map is deliberately incomplete and somebody has to say go. Null means
   *  nothing is waiting — it fitted and it was done, or it is running now. */
  trace_cost: TraceCost | null
  /** Where a running trace has got to, from the process doing it — null when none is.
   *
   *  Its own field beside `tracing`, which is the REPLAY's progress: they are two depths of
   *  one instrument and they run independently, so a row folding them into one would report
   *  whichever started last. */
  tracing_history: Progress | null
  /** Files with per-line history, and how many the trace set out to resolve.
   *
   *  **Divide these by each other and nothing else.** `files` beside them is a different count —
   *  what a reader could be handed — and using it as the denominator left the fraction unable to
   *  reach one, so the Trace pill went on offering work that was already done. */
  resolved: number
  resolvable: number
  /** The repo has moved since this scan, and rescanning it is over budget. The one state where
   *  a map is knowingly out of date — small repos are repaired within a tick and never set it. */
  behind: boolean
  /** What a scan of this repo would cost, when nobody has been asked yet.
   *
   *  Present ONLY for a repo whose scan was declined: there is no tree, every count is zero
   *  because nothing has been measured, and this is what the row offers instead. */
  scan_cost: ScanCost | null
  /** Which agent reads this repo. Machine-local — which CLI you have is a fact about this
   *  laptop, not about the repo. Null until somebody chooses. */
  harness: string | null
  /** Which model was chosen here, for a repo with no readings yet to say. */
  model: string | null
  /** Which model the banked readings were actually taken by, when they agree.
   *
   *  The authority, over `model`. Never mixing models in one repo is what keeps the map on
   *  one scale, and a stored preference cannot enforce that across two laptops. Null when
   *  there are no readings, or when they already disagree — and disagreement is worth
   *  showing rather than resolving. */
  banked_model: string | null
  /** Which agent the banked readings were actually taken by, when they agree.
   *
   *  The authority over `harness`, on the same grounds: the index is one laptop's
   *  preference, while this travels with the repo. Null when there are no readings or when
   *  they disagree, which is the case where choosing for somebody would be wrong. */
  banked_harness: string | null
  /** Every model this repo's readings were taken by, commonest first.
   *
   *  One entry is the ordinary case. More than one means the map is already on two scales,
   *  which `banked_model` reports only as `null` — this is the part somebody can act on. */
  banked_models: { model: string; readings: number }[]
  /** The model of the newest DATED reading, when there is one.
   *
   *  What a mixed corpus offers in place of a banked model: with several scales in the
   *  repo there is nothing to "continue", and the last one used is what somebody most
   *  likely means. Null for a corpus banked entirely before readings carried a date. */
  recent_model: string | null
  /** The wave in progress, if any. */
  run: {
    /** Current readings the repo held when this run started — see `runProgress`. */
    from: number
    harness: string
    model: string
    readers: number
    spawned: number
    finished: number
    failed: number
    running: boolean
    /** Asked to stop, readers not yet dead. Reported by the backend rather than held by
     *  whichever window clicked, so a terminal tailing the same run sees it too. */
    stopping: boolean
    /** Reader processes still alive. Counts down while stopping. */
    live: number
    ended: string | null
    /** What failed readers said on the way out, deduped and capped. Empty when nothing
     *  failed, or when the readers were killed on purpose. */
    failures?: string[]
  } | null
  /** The last few functions out and back, oldest first.
   *
   *  Sanity can say what is being read RIGHT NOW, which it could not while an agent
   *  session was the only party that knew. In memory and bounded: the record is
   *  `.sanity/`, and a second store the user cannot see is the mirror that made deleting
   *  the visible one appear to do nothing. */
  events: {
    seq: number
    stage: 'out' | 'read'
    name: string
    path: string
    predicted?: 'full' | 'most' | 'some' | 'none'
  }[]
  touched: number
  /** An agent has called about this project in the last minute. Per project, so two
   *  sessions working two repos both report as working. */
  working: boolean
  /** Known from the index but not yet rescanned on startup, so `functions` and `assessed`
   *  are zero because nothing has counted them — not because the repo is empty. The row
   *  shows its name and holds its place; the counts wait. */
  loading: boolean
  /** This app is not holding a scan for the project — and nothing is on its way either.
   *
   *  **A third state, and it has to be a fact rather than the absence of the other two.**
   *  `phasesOf` read "scanned" as `!scan_cost && !loading`, which was true of every row
   *  that had been scanned and also of the one Reset leaves behind: the pill ticked Scan
   *  over `0 functions in 0 files`, the trace gauge reported `no git history here` about a
   *  repo nobody had walked, and Read offered to read nothing. A row that has walked
   *  nothing must not answer questions about what is in the repo.
   *
   *  Set on a project the app knows from the index and is not holding — after a reset,
   *  before the restore reaches it, or when its scan was declined for cost. The counts on
   *  such a row are zeros standing for "not measured", exactly as they are behind
   *  `loading`. */
  unloaded?: boolean
  /** How far the pending rescan has got. Both zero means it is still walking the repo and
   *  has no denominator yet — a real state, not zero percent. */
  read_done: number
  read_total: number
  /** What the scan is doing — see `Progress.phase`. */
  read_phase?: string
  /** What `read_done` and `read_total` are counting — see `Progress.unit`. */
  read_unit?: string
}

export interface ProjectList {
  active: string | null
  projects: ProjectSummary[]
}

/** What sanity is holding, and which one the window should show. Polled, because an
 *  agent can open a project at any moment and the window is meant to just follow. */
export function listProjects(): Promise<ProjectList> {
  return invoke<ProjectList>('projects')
}

/** The repo's remote as `owner/name`, or null — the name a repo answers to in public,
 *  for the caption on an exported movie. See `repo_remote`. */
export function repoRemote(path: string): Promise<string | null> {
  return invoke<string | null>('repo_remote', { path }).catch(() => null)
}

/** Which commit the working tree is at — see `repo_head` in Rust. `dirty` is null where git
 *  would not say, which is not the same as clean. */
export interface RepoHead {
  sha: string
  dirty: boolean | null
}

export function repoHead(path: string): Promise<RepoHead | null> {
  return invoke<RepoHead | null>('repo_head', { path }).catch(() => null)
}

/** The text of one file in the open repo. Rust checks the path stays inside the repo —
 *  see `read_source`. */
export function readSource(repo: string, relPath: string): Promise<string> {
  return invoke<string>('read_source', { repo, relPath })
}

/** Open one file's code view in a window of its own. */
export function openCodeWindow(repo: string, relPath: string): Promise<void> {
  return invoke('open_code_window', { repo, relPath })
}

/** The rings inside a set of file wedges. See `Node.funcs` and `file_functions`.
 *
 *  Asked for per file rather than sent with the tree: a repo's worth of them is 75MB on
 *  ceph, almost none of it drawable, and it cost five seconds of parsing before anything
 *  appeared.
 *
 *  **A set per call, not a file per call.** Rust finds them by walking the tree, so one
 *  path per call was one walk of the whole repo per file — and drilling asks for every file
 *  in a directory at once. On linux that was a flat two seconds on every change of level,
 *  the same two seconds wherever you went, because it was paced by the size of the repo
 *  rather than of the directory. A path the tree does not hold is simply absent from the
 *  answer. */
export async function fileFunctions(key: string, paths: string[]): Promise<Map<string, Node[]>> {
  const wire = await invoke<Record<string, WireNode[]>>('file_functions', { key, paths })
  return new Map(Object.entries(wire).map(([path, fns]) => [path, fns.map(toNode)]))
}

/** One place a search found what was typed. Mirrors `search::Hit`. */
export interface Hit {
  /** The node's id — a path for a container, `path#name@line` for a function. */
  id: string
  /** The file or directory this is in, or IS. What the camera flies to. */
  path: string
  name: string
  kind: 'dir' | 'file' | 'func'
  /** Where in the file, for a function; `0` on a container. Functions are pointed at by
   *  LINE and never by name — a dozen `init`s in one file are a dozen functions. */
  line: number
  loc: number
  lang: string | null
}

/** Where a name is on the map, best first. See `search::find`.
 *
 *  **Asked of the backend, not of the tree in the window.** A large repo is drawn from a
 *  slimmed tree that carries no function names at all — so the search a person types would
 *  come back empty on exactly the repos big enough to need one. The backend's copy is whole.
 *
 *  `limit` is what the list can show, not what the search considers: the ranking runs over
 *  every match and the truncation happens after it, or the best answer would be missing
 *  because it lives in a directory the walk reaches late. */
export function searchProject(key: string, query: string, limit: number): Promise<Hit[]> {
  return invoke<Hit[]>('search_project', { key, query, limit })
}

/** One rule's answer. Mirrors `findings::Group`.
 *
 *  **`total` is how many findings there are and `hits` is how many were sent** — the backend caps
 *  the rows at `findings::PER_GROUP`, because ceph's load-bearing rule finds four thousand and a
 *  panel draws thirty. A count printed off `hits.length` would quietly report the cap. */
export interface FindingGroup {
  /** Stable across renames — what a dismissal is filed under, never the title. A title is
   *  prose and gets reworded; keying durable state on it orphans every decision made under
   *  the old one. Same rule as `key_of` versus a node id. */
  id: string
  title: string
  soWhat: string
  /** 1 where the scan alone can answer it, 2 where it needs a reading. */
  tier: number
  /** The rule in the grammar somebody could have typed, e.g. `func: loc >= 200`. */
  expr: string
  total: number
  /** How many this rule found that somebody has already set aside.
   *
   *  Shown rather than hidden: a rule quiet because its findings were all dealt with is a
   *  different sentence from one that never found any, and the second is what a reader
   *  assumes when a list is empty. */
  dismissed: number
  /** How many of these findings no other rule found. */
  only: number
  /** The lenses this rule combined, as `ColorMode` ids — plus `size`, which is not a lens but
   *  is how the map draws lines. Mirrors `findings::Rule::lenses`.
   *
   *  **The pair IS the claim.** Surprise and reach is a different sentence from surprise and
   *  size, and a finding exists precisely because no single lens can be worn to see it. */
  lenses: string[]
  /** Why this rule could not answer, and what would fix it — `null` where it could.
   *
   *  **A blocked rule is not a rule with no hits**, and the panel must never draw them alike:
   *  one is "nothing here matches" and the other is "this could not be asked", which is the
   *  same distinction the map keeps between an unread wedge and a cold one. */
  blocked: Blocked | null
  /** The half of the rule's paragraph that is the same on every subject — `''` where it has
   *  none. Mirrors `findings::Rule::background`.
   *
   *  **Shown under the first tile this rule appears on, and not again.** A repo with three
   *  crowded files printed the same lesson three times, each under its own count; it is worth
   *  reading once, and on the second tile it says nothing about that file while pushing the
   *  next measurement off the screen. The split is mechanical rather than editorial — `says`
   *  is every sentence that quotes the subject's own numbers, this is the prose that quotes
   *  none — so nothing subject-specific can end up in the half that gets hidden. */
  background: string
  hits: Finding[]
}

/** Why a rule cannot answer, and the one thing that would let it. Mirrors
 *  `findings::Blocked`.
 *
 *  **`why` is read one rule at a time and `need` is read across the catalog.** The footer
 *  folds by `need`, because seven sentences that all mean *read the repo* are one job printed
 *  seven times, and how much of the catalog one pass would light up is not a question the
 *  sentences can be asked without matching on their words. */
export interface Blocked {
  why: string
  /** `read required`, `trace required`, or `nothing to compare` where no button exists. */
  need: string
}

/** One finding: where to fly, and what to file a decision about. Mirrors `findings::Finding`.
 *
 *  **`hit.id` and `key` are not interchangeable.** The first embeds `@line` and is what the
 *  camera flies to; the second is what a dismissal is stored under and survives the body
 *  moving down the file. */
export interface Finding {
  key: string
  hit: Hit
  /** Somebody has committed to doing this. Sent on the finding rather than joined from the
   *  archive here — a join done in two places is a join that disagrees with itself. */
  flagged: boolean
  /** This rule's sentence about THIS subject, split at its numbers — rendered by
   *  `findings::render` so the panel and `just findings` say the same thing.
   *
   *  **Spans rather than a marked-up string**, so nothing here has to parse prose back out:
   *  the runs with `filled` set came from the subject's own measurements, and are the half
   *  somebody scans for.
   *
   *  **Falls back to the rule's short form when a number is missing.** A sentence with a hole
   *  in it, or a `0` where a measurement should be, is the map claiming something nobody
   *  measured — so the engine drops the tailored sentence whole rather than half-filling it. */
  says: Say[]
  /** This rule asked a reader's grade, and the reading is of code that has since changed. The
   *  finding stands on the last reading anybody made, and says so. */
  stale: boolean
}

/** One run of a rendered sentence. Mirrors `findings::Span`. */
export interface Say {
  text: string
  /** True where this run is a number this subject actually has. */
  filled: boolean
}


/** What somebody decided about a finding. Mirrors `findings::Verdict`.
 *
 *  - `flagged` — needs doing. Stays in the list and rises to the top of it.
 *  - `fine-for-now` — fine as the code stands; comes back when the code moves.
 *  - `fine-always` — fine whatever the code does.
 *  - `false-positive` — the finding was not TRUE. Hidden until the rule changes rather than
 *    until the code does: the rule is just as wrong tomorrow, and a rule that starts asking a
 *    different question may be right. The two "forever" verdicts differ in who is wrong. */
export type Verdict = 'flagged' | 'fine-for-now' | 'fine-always' | 'false-positive'

/** One finding somebody has decided about. Mirrors `findings::Decision`. */
export interface Decision {
  /** `key_of(path, name, ord)` for a function, the path for a file — never a node id. */
  key: string
  /** The rule's stable id. */
  rule: string
  /** What that rule was CALLED when this was filed — part of the record, not looked up. */
  title: string
  verdict: Verdict
  /** The state the code was in when this was said. `fine-for-now` expires when it moves. */
  pin: string
  reason: string
  when: string
  by: string
}

/** One clause of a rule. Mirrors `findings::ClauseView`. */
export interface Clause {
  field: string
  op: string
  value: number
  /** The lens this clause is painted by, or null where there is none. `read` has none: an
   *  absence of readings is not a lens, and colouring the word as though it were invents one. */
  lens: string | null
  /** What normal looks like for this field across the rule's population — a fact about the
   *  FIELD, so it travels with the clause rather than being described in prose beside it. */
  median: number | null
  /** The bar this repo would suggest, where that is not the bar it has. Only on the
   *  calibrated clause. */
  suggestion: number | null
}

/** One rule as the editor sees it. Mirrors `findings::RuleView`.
 *
 *  **Clauses come structured, not as the rendered `expr`.** `func: loc >= 257` is the right
 *  thing to show and the wrong thing to populate controls from — parsing back a string the
 *  backend just rendered would be a second parser, disagreeing with the first the day somebody
 *  adds an operator. */
export interface RuleView {
  id: string
  title: string
  soWhat: string
  says: string
  pop: 'func' | 'file'
  clauses: Clause[]
  calibrated: number
  tier: number
  expr: string
  lenses: string[]
  /** False where this repo's file says `off`. Silenced rules are still listed — one somebody
   *  has to go and find again is one they will not turn back on. */
  on: boolean
  /** Shipped by sanity. A rule of your own can be deleted; a built-in can only be silenced,
   *  because a later release would bring it back regardless. */
  builtIn: boolean
  /** What it finds here now, and how much of that nothing else found. */
  hits: number
  /** How many subjects this rule's population has here — the denominator for `hits`. */
  population: number
  only: number
  /** Why it cannot answer here, in words, or null. */
  blocked: string | null
}

/** What normal looks like for one field, over one population. */
export interface Spread {
  n: number
  median: number
  p95: number
  max: number
}

/** One field a clause may name. Mirrors `findings::FieldView`.
 *
 *  **The picker is built from this, never from a list kept here.** Two lists of fields is one
 *  list plus a stale copy, and the stale one is the one still offering a field that was
 *  renamed — which is not hypothetical: `legible` became `illegible` this week. */
export interface FieldView {
  name: string
  /** What it is measured over. `repo` fields are the same for every subject — they gate a rule
   *  rather than narrowing it. */
  scope: 'subject' | 'file' | 'repo'
  lens: string | null
  /** The population this field can only be asked of, or null for both. */
  pop: 'func' | 'file' | null
  /** Tier 2 — silent until somebody has run a reading pass here. */
  needsReading: boolean
  /** This repo's distribution, per population. Null where nothing here has a value, which is
   *  itself worth showing: a threshold typed against no data is a guess. */
  func: Spread | null
  file: Spread | null
}

/** Every field and operator a clause may name, measured against this repo. */
export interface Grammar {
  fields: FieldView[]
  ops: string[]
}

/** One walk's worth of answers. Mirrors `findings::ProjectReport`.
 *
 *  **One call, because it is one answer.** The findings, the rules and the grammar were three
 *  commands, and each built the whole fact set for itself — three walks of the tree under one
 *  lock, which on kibana is 540,000 records to answer three questions about one repo. They
 *  are also the same measurement seen three ways, so fetching them separately was three
 *  chances for the grid, the list and the creature to describe different states of it. */
export interface ProjectReport {
  groups: FindingGroup[]
  rules: RuleView[]
  grammar: Grammar
}

export function projectReport(key: string): Promise<ProjectReport> {
  return invoke<ProjectReport>('project_report', { key })
}

/** A rule on its way back. Mirrors `findings::RuleEdit`.
 *
 *  **Not a `RuleView` with fields omitted.** What comes out carries what the backend
 *  MEASURED — the lens on each clause, the median, the suggested bar, the hit counts, why it
 *  is blocked — and none of that is something a form has an opinion about. Writing this as
 *  `Omit<RuleView, …>` said the two shapes are one shape with holes in it, and they are not:
 *  they travel in opposite directions and only overlap. */
export interface RuleEdit {
  /** Empty for a rule being created — the backend mints the id from the title, once, and
   *  never regenerates it: it is what a decision is filed under. */
  id: string
  title: string
  soWhat: string
  says: string
  pop: 'func' | 'file'
  clauses: Pick<Clause, 'field' | 'op' | 'value'>[]
  calibrated: number
  /** False silences it. A built-in is silenced rather than deleted, because a later release
   *  would ship it again. */
  on: boolean
}

/** Write one rule back — a changed threshold, a floor, a silence, or a rule of your own.
 *
 *  Rejects with the reason when what was sent is not a rule: the backend refuses rather than
 *  silently correcting, so the message is meant to be shown. */
export function saveRule(project: string, rule: RuleEdit): Promise<void> {
  return invoke<void>('save_rule', { project, rule })
}

/** Delete a rule of your own; silence a built-in. */
export function deleteRule(project: string, id: string): Promise<void> {
  return invoke<void>('delete_rule', { project, id })
}

/** Put a built-in back the way it ships. */
export function resetRule(project: string, id: string): Promise<void> {
  return invoke<void>('reset_rule', { project, id })
}

/** One rule's part in a balance — see `findings::BalanceRow`. `to` is null where the balance
 *  leaves the rule alone. */
export interface BalanceRow {
  id: string
  title: string
  field: string
  op: string
  from: number
  to: number | null
  hitsBefore: number
  hitsAfter: number
  onlyBefore: number
  onlyAfter: number
}

/** Thresholds that bring the list toward `target` findings, counted once each. Nothing is
 *  written until `applyBalance`. */
export interface Balance {
  target: number
  before: number
  after: number
  rules: BalanceRow[]
}

export function balanceRules(project: string, target: number): Promise<Balance> {
  return invoke<Balance>('balance_rules', { project, target })
}

/** Save the thresholds somebody ticked, as `[rule id, value]`. */
export function applyBalance(project: string, thresholds: [string, number][]): Promise<void> {
  return invoke<void>('apply_balance', { project, thresholds })
}

/** Every rule as sanity ships it: this repo's changes and its own rules are removed. */
export function stockRules(project: string): Promise<void> {
  return invoke<void>('stock_rules', { project })
}

/** Record what somebody decided about a finding.
 *
 *  Rejects rather than resolving quietly when the write fails: a panel that stops drawing a
 *  finding on the strength of a write it never checked is claiming something it does not know. */
export function decideFinding(
  project: string,
  key: string,
  rule: string,
  verdict: Verdict,
  reason: string,
): Promise<void> {
  return invoke<void>('decide_finding', { project, key, rule, verdict, reason })
}

/** Take a decision back, returning the finding to the list. */
export function undecideFinding(project: string, key: string, rule: string): Promise<void> {
  return invoke<void>('undecide_finding', { project, key, rule })
}

/** Everything decided in this repo, newest first — including entries whose pin has moved,
 *  whose findings are therefore already back in the list. */
export function projectDecisions(key: string): Promise<Decision[]> {
  return invoke<Decision[]>('project_decisions', { key })
}

/** One function, as a row in a list of its neighbours. Mirrors `links::Ref`. */
export interface FuncRef {
  path: string
  name: string
  owner: string | null
  line: number
  loc: number
}

/** What one function is connected to. Mirrors `links::Related`.
 *
 *  **`wired` and `comparable` are why this is a shape and not two arrays.** An empty
 *  `callers` means "nothing in this repo calls it" only when `wired` is true; otherwise it
 *  means the language's call shape was never parsed, which is the same absence the map paints
 *  gray. Two lists that look identical and mean opposite things is precisely what the counts
 *  already refuse to do. */
export interface Related {
  callers: FuncRef[]
  calls: FuncRef[]
  clones: FuncRef[]
  wired: boolean
  comparable: boolean
}

/** Who a function's neighbours are — fetched on selection, never sent with the tree.
 *
 *  `null` where the scan holds no function starting at that line (an edit since the scan, a
 *  synthesised roll-up wedge) or where the table has not been built. The panel says so rather
 *  than drawing an empty list, which would read as a function with no neighbours. */
export async function functionLinks(
  key: string,
  path: string,
  line: number,
): Promise<Related | null> {
  return invoke<Related | null>('function_links', { key, path, line })
}

/** One decision point the Complexity count was made of. Mirrors `parse::Fork`. */
export interface Fork {
  line: number
  cost: number
  /** How many forks this one sits inside. NOT derivable from `cost`: a chained `else if` and
   *  a logical operator are charged flat, so a `+1` three levels deep is correct. */
  depth: number
  /** Why it cost what it did — `fork` nests, `chain` is a continuation charged flat, `logic`
   *  is an operator adding a condition rather than a level. */
  kind: 'fork' | 'chain' | 'logic'
}

/** One function's body and every charge in it. Mirrors `commands::Forks`.
 *
 *  **The total comes from the same walk that found the sites**, so the panel never adds the
 *  list up itself. A pane that recomputed the figure from the rows it drew could only ever
 *  agree with itself. */
export interface Forks {
  cognitive: number
  /** The body's first line, one-based — what the gutter numbers from. */
  start: number
  /** The body verbatim, indentation kept. */
  lines: string[]
  /** Cut at `MAX_BODY_LINES`, and said out loud rather than left to look like a short body. */
  truncated: boolean
  /** Every charge, by line. A line can hold more than one — `if (a && b)` is two. */
  forks: Fork[]
}

/** Re-parsed from the working tree on selection, never read out of the scan — see
 *  `commands::function_forks` for why the sites are not stored.
 *
 *  `null` for a language with no branch table, or where no function starts at that line
 *  because the file has moved since the scan. */
export async function functionForks(
  key: string,
  path: string,
  line: number,
): Promise<Forks | null> {
  return invoke<Forks | null>('function_forks', { key, path, line })
}

/** The source of one function, as the panel asks for it. Mirrors `commands::Snippet`. */
export interface Snippet {
  text: string
  /** The name is nowhere near the top of these lines, so the file has moved since the scan
   *  cut them and this is probably somebody else's code. Shown as a caveat, never corrected:
   *  the fix for a stale scan is a scan. */
  moved: boolean
  /** Cut at the backend's line cap — said out loud so an expanded view is never quietly a
   *  partial one. */
  truncated: boolean
}

/** The source behind a list of neighbour rows, in one call.
 *
 *  **A set per call, not a row per call.** A function with two hundred callers would be two
 *  hundred round trips and two hundred reads of files that repeat; Rust reads each file once
 *  however many spans land in it. The answer is positional — one entry per span, `null` where
 *  the file could not supply those lines. */
export async function functionSources(
  key: string,
  spans: { path: string; start: number; end: number; name: string }[],
): Promise<(Snippet | null)[]> {
  return invoke<(Snippet | null)[]>('function_sources', { key, spans })
}

/** One commit in a function's line history. Mirrors `blame::Touch`. */
export interface Touch {
  commit: string
  author: string
  /** Author time, seconds since the epoch — formatted in the reader's own locale here, which
   *  is the reason it crosses the wire as a number. */
  when: number
  summary: string
  /** How many of the range's CURRENT lines still come from this commit. Zero is a real
   *  answer: the commit changed these lines and its work has since been replaced. */
  lines: number
  /** The path these lines were under at this commit, when it is not the one being shown — a
   *  rename both halves of this record cross and both now report. */
  path: string | null
}

/** What the far end of a line walk was. Mirrors `blame::Origin`, and there is no third
 *  variant: a rewrite does not stop the walk, git follows the replaced lines to what they
 *  replaced — which is a caveat about the dates reaching too far BACK, not about them
 *  stopping short. */
export type Origin = 'created' | 'added'

/** One function's line history. Mirrors `blame::LineHistory`.
 *
 *  **One record, because Blame, Churn and Age are three questions about one history.** They
 *  read two different populations for a while — blame sees the commits whose lines SURVIVED,
 *  `git log -L` sees every commit that changed the range — and two lenses on two fetches
 *  disagree about when a function began while each is internally right, with nothing on screen
 *  saying which population a date came from. `changes` is the history and `touches` is what is
 *  left of it; every row of the first carries its own share of the second. */
export interface LineHistory {
  /** Every commit that CHANGED these lines, newest first. Empty for a whole-file query. */
  changes: Touch[]
  /** The commits whose lines are still here — a subset of `changes`, and what Blame is about. */
  touches: Touch[]
  authors: { author: string; lines: number }[]
  lines: number
  origin: Origin
  /** The oldest commit touching this PATH at all, worth printing against an `added` origin. */
  fileFirst: number | null
  /** The worktree differs from HEAD here, so the scan's lines may not be HEAD's lines. */
  dirty: boolean
}

/** One file's part in one commit. Mirrors `commands::CommitFile`. */
export interface CommitFile {
  path: string
  added: number
  removed: number
}

/** Everything about one commit a panel row cannot hold. Mirrors `commands::CommitDetail`. */
export interface CommitDetail {
  sha: string
  short: string
  author: string
  email: string
  when: number
  subject: string
  body: string
  files: CommitFile[]
  added: number
  removed: number
}

/** One commit, in full — fetched when somebody opens a row that names one.
 *
 *  `null` for a sha this repo does not have, or one that is not a sha: the shas reaching this
 *  come from blame and from the replay's own log, and a revision expression built out of a
 *  string is a place to be careful. Rust checks before it shells out. */
export async function commitDetail(key: string, sha: string): Promise<CommitDetail | null> {
  return invoke<CommitDetail | null>('commit_detail', { key, sha })
}

/** One function's whole line history, on demand: every commit that changed these lines, the
 *  ones whose lines survive, and who owns what is left.
 *
 *  Four git processes in parallel — a `git blame -L`, a `git log -L`, the path's own log and a
 *  dirty check — so it is seconds on a hot file in a deep repo, asked for when a history lens
 *  is open and never with the tree. One call for three lenses: see `LineHistory`. */
export async function functionHistory(
  key: string,
  path: string,
  start: number,
  end: number,
): Promise<LineHistory | null> {
  const r = await invoke<{
    changes: Touch[]
    touches: Touch[]
    authors: { author: string; lines: number }[]
    lines: number
    origin: Origin
    file_first: number | null
    dirty: boolean
  } | null>('function_history', { key, path, start, end })
  return r && { ...r, fileFirst: r.file_first }
}

export async function projectScan(key: string): Promise<Scan | null> {
  const w = await invoke<WireScan | null>('project_scan', { key })
  return w ? toScan(w) : null
}

/** Four-step ordinal from the agent — see `Grade` in agentapi.rs for why it isn't a
 *  0-100. */
export type Grade = 'full' | 'most' | 'some' | 'none'

export interface AgentReport {
  id: string
  /** Lines in the function this reading is about, and whether it has expired — both stamped
   *  by the backend, which is the only party that can see the live body. See `pending`. */
  loc?: number
  stale?: boolean
  /** What the agent predicted BEFORE reading the body. */
  expected: string
  found: string
  /** Superseded by `predicted`; still present on reports banked before the grades. */
  surprised: boolean
  /** How much of the body the prediction covered. */
  predicted?: Grade
  /** How well the docs it was handed cover what the code does. */
  documented?: Grade
  /** Whether those docs say anything the code didn't already. */
  derivable?: boolean
  /** How clear the body was once open — the second axis. Absent on readings banked before
   *  the field existed; absent is "no opinion", never a grade. */
  legible?: Grade
  /** This grade answers a question that has since been rewritten — see `Report::spec`.
   *
   *  Decided in Rust and sent as a boolean, deliberately. Which spec changed the meaning of
   *  which axis is a judgement, and mirroring the constants here would put it in two places
   *  — the copy nobody is looking at being the one that goes wrong. The browser's whole job
   *  is to paint what it is told.
   *
   *  Treated exactly like `agentStale`: the grade is kept and shown as history, but it does
   *  not color a wedge and does not count anywhere. A number whose question has moved is
   *  a term claiming confidence it has not got. */
  legibleDated?: boolean
  /** The reader says something here will bite whoever edits it next. */
  trap?: boolean
  /** This answer was given under an earlier version of the trap question — see
   *  `legibleDated`, which this follows in every respect. Two flags and not one, because
   *  the two axes moved at different specs and a reading can be current on one and
   *  superseded on the other. */
  trapDated?: boolean
  note: string
  /** Was the reader seeing this file for the first time? Self-declared. */
  cold: boolean
  /** Hash of the body this reading was made against. Empty on readings banked before
   *  the committed store existed — those are taken at their word rather than shown as
   *  expired, which would present every migrated reading as broken. */
  body?: string
  /** Which model made the reading, as it reported itself. Absent on readings banked
   *  before the field existed — the panel falls back rather than inventing one. */
  model?: string
  /** Git identity of whoever ran the reading, and the commit it was made at. Shown as
   *  provenance; nothing keys off either. */
  by?: string
  at?: string
}

/**
 * Has the code moved out from under this reading?
 *
 * Mirrors `assessment::is_stale`. The reading itself is still true about the code it was
 * made against — it just isn't about *this* code any more, and the panel says so rather
 * than deleting it.
 */
export function isReportStale(r: AgentReport, node: Node): boolean {
  if (!r.body || !node.body) return false
  return r.body !== node.body
}

/** Mirrors `Grade::surprise` and `Grade::documented` in Rust. Duplicated rather than
 *  sent over the wire because the mapping is a claim about the metric, and it should be
 *  reviewable in the two places the metric is computed. */
/** Exported so the summary can paint a grade with the ramp the map paints it with. The
 *  spacing is deliberately uneven — the two confident steps sit close together — so a panel that re-derived its own
 *  swatches from an even 0/⅓/⅔/1 would show four colors the map never uses. */
export const GRADE_SURPRISE: Record<Grade, number> = {
  full: 0.08,
  most: 0.3,
  some: 0.62,
  none: 0.92,
}
/** Exported for the replay, which builds the same numbers out of a packed reading rather
 *  than out of a report — see `readingInto`. Two copies of this table would be two scales
 *  for one lens, with the frame and the live map disagreeing about the same grade. */
export const GRADE_DOCUMENTED: Record<Grade, number> = {
  full: 0.95,
  most: 0.7,
  some: 0.35,
  none: 0,
}

/** The same four steps as the GAP they leave — what the Docs lens paints.
 *
 *  Not `1 - GRADE_DOCUMENTED`, though it is nearly that: a ramp input is a position on a
 *  scale and wants the ends pinned, so `none` is 1 rather than 0.95's complement. The
 *  direction is the point — see the `--docs-*` ramp. Bright is what needs writing. */
export const DOC_GAP: Record<Grade, number> = { full: 0.05, most: 0.3, some: 0.65, none: 1 }

/**
 * A reading's legibility grade, or undefined if it has none THAT STILL MEANS ANYTHING.
 *
 * One accessor, because a grade whose question has moved is not a grade any more and every
 * consumer has to agree about that — the lens, the breakdown, the panel and the spread. When
 * `legible` was read straight off the report in four places, a bump to the ask would have
 * been honored wherever somebody remembered and ignored everywhere else, which is worse
 * than not bumping: the map would disagree with the panel beside it about the same wedge.
 *
 * A dated grade is kept on the report and shown as history — see `legibleDated`. What it
 * does not do is color, count, or bucket.
 */
export function legibleOf(r: AgentReport | undefined): Grade | undefined {
  if (!r || r.legibleDated) return undefined
  return r.legible
}

/**
 * Whether this reading reports a trap under TODAY's question — see `legibleOf`, which this
 * is the twin of, for why an accessor and not a field read.
 *
 * The four places that ask are the lens, the pulse on the patch, the panel's own banner and
 * the tally in the summary. When they read `r.trap` directly, a bump to the ask was honored
 * wherever somebody remembered, which is worse than not bumping: the map would flag a wedge
 * the panel beside it describes as ungraded.
 *
 * The reader's answer is kept and shown as history. What it no longer does is color, pulse
 * or count.
 */
export function trapOf(r: AgentReport | undefined): boolean {
  return !!r?.trap && !r.trapDated
}

/** The report's two grades, with two rules applied that the grades themselves do not carry.
 *
 *  A pre-grade report knew only surprised-or-not, so it maps to the ends of the scale —
 *  coarse, but inventing a middle grade for it would be making up a judgement nobody made.
 *  And **`derivable` forces `documented` to none**, whatever grade the reader gave it: a
 *  doc a model could regenerate from the body explains nothing that was not already there.
 *  That second rule lived only in an inline comment, so a reader predicting this function
 *  from the outside had no way to know the returned number is not the reported one.
 *  Mirrors `Report::grades` in Rust. */
export function reportGrades(r: AgentReport): { surprise: number; documented: number | null } {
  const predicted = r.predicted ?? (r.surprised ? 'none' : 'full')
  const documented = r.derivable ? 'none' : r.documented
  return {
    surprise: GRADE_SURPRISE[predicted],
    documented: documented ? GRADE_DOCUMENTED[documented] : null,
  }
}

/**
 * A grade's name on screen, which is the grade's own name: `full`, `most`, `some`, `none`.
 *
 * **Three lenses grade on one scale, and they used to print it in three vocabularies.** Surprise
 * said `mundane / typical / quirky / obscure`, Legibility `clean / nuanced / tangled / unclear`
 * and Docs `full / decent / some / none`, so a report defining Surprise had to translate its own
 * figure before a word of its results could be read, and `tangled` was a Legibility grade on one
 * page and the Complexity rule "Tangled for its size" on the next. The store, the reader's
 * schema, the CLI and the rule grammar all said `full / most / some / none` throughout.
 *
 * **The inversion those words were chosen to hide is answered by naming the question.** Bare,
 * `none` is the calm end of one lens and the alarming end of the next, which is what the
 * temperatures and then the amounts of surprise before them ran into. `predicted: none`,
 * `legible: none` and `docs: none` are each the bright end, because every one of these grades
 * is an answer about coverage and `full` is dim on all three. So a surface that shows a grade
 * outside its own lens's section says which question it answers.
 */
export const GRADE_WORDS: Record<Grade, string> = { full: 'full', most: 'most', some: 'some', none: 'none' }

/** The grades a reader gave a wedge it actually read, or null if nobody has.
 *
 *  Null for a proxy or model score on purpose: those are continuous and mean something
 *  different, and giving them a grade would claim a reader's judgment where there is an
 *  estimate. A stale reading is null too: it has already stopped coloring the wedge. */
export function readingWords(node: Node): { predicted: Grade; documented: Grade | null } | null {
  if (node.kind !== 'func' || !node.agent || node.agentStale) return null
  const r = node.agent
  return {
    predicted: r.predicted ?? (r.surprised ? 'none' : 'full'),
    documented: r.derivable ? 'none' : (r.documented ?? null),
  }
}

/** What agents have reported for one project. Pass the key of the project ON SCREEN —
 *  without it the backend answers for whichever repo an agent last opened, which is not
 *  the same thing the moment there are two. */
export function agentReports(key: string | null): Promise<AgentReport[]> {
  return invoke<AgentReport[]>('agent_reports', { key })
}

/**
 * Fold agent reports into the tree.
 *
 * An agent's verdict is binary — it either predicted the body or it didn't — so it maps
 * to the ends of the scale rather than somewhere in the middle. That honesty is the
 * point: this is not a probability, it is a reader saying "this caught me out", and
 * dressing it up as 0.73 would imply a precision nobody measured.
 */
/**
 * One reading, folded into the function it describes.
 *
 * **Extracted so the two ways a function reaches the map share one definition.** A tree
 * arrives without its functions — see `Node::slim` — so `applyAgentReports` folds readings
 * into a tree that has none, and the rings turn up later from `fileFunctions` carrying raw
 * scan nodes. Nothing re-applied to those, so every function reading in every repo was
 * invisible while the store held 768 of them and the status line reported 69.9% read.
 *
 * Returns `node` unchanged when there is no reading or no score, so a caller can hand it
 * everything and let identity say what moved.
 */
export function readInto(node: Node, r: AgentReport | undefined): Node {
  if (!r || !node.score) return node
  // **Already folded, and by the same reading.** The poll refetches every reading every two
  // seconds and folds the lot back in, so without this every read function in the repo became
  // a new object on a fixed period — a tree that means nothing new, handed to consumers whose
  // memos exist to ask exactly that. It rests on the readings keeping their identity between
  // polls when nothing about them moved; see `keepReadings`, which is where that is arranged.
  if (node.agent === r) return node
  // A reading whose code has changed does NOT color the wedge. It described a body
  // that is not there any more, and letting it keep painting is the exact failure
  // the metric refuses everywhere else — a number claiming confidence it no longer
  // has. The wedge falls back to the proxy, which is what an unread function looks
  // like, because that is what this now is. The reading is still attached, and the
  // hatch on the map plus the panel say why it went quiet.
  if (isReportStale(r, node)) {
    return {
      ...node,
      agent: r,
      agentStale: true,
      score: node.proxyScore ?? node.score,
      proxyScore: undefined,
    }
  }
  return {
    ...node,
    agent: r,
    agentStale: false,
    proxyScore: node.proxyScore ?? node.score,
    score: {
      ...node.score,
      // Both numbers from the SAME instrument. Overwriting surprise while leaving
      // `documented` behind is what produced the incoherent panel: an agent's 90
      // multiplied by a lexical heuristic's 0. If the reader graded the docs, its
      // grade wins; if it didn't, the proxy's estimate stands and `source` says so.
      ...(() => {
        const g = reportGrades(r)
        return g.documented === null
          ? { surprise: g.surprise }
          : { surprise: g.surprise, documented: g.documented }
      })(),
      source: 'agent',
      analyzedShare: 1,
    },
  }
}

/** The readings the window is holding, and what it takes to tell a poll that brought
 *  something from one that brought the same answer again.
 *
 *  **Every reading is refetched every two seconds** — 16,925 of them on tonepoet — and each
 *  one arrives freshly deserialized, so identity is worthless as it comes off the wire and
 *  identity is exactly what everything downstream reads as "this means something new". A
 *  fold of the raw list therefore rebuilt every wedge that had ever been read, and with it
 *  every directory above them, to carry the one reading that had actually landed. */
export interface Held {
  /** The list to fold: the poll's, with everything that did not move kept as the object it
   *  already was. */
  list: AgentReport[]
  byId: Map<string, AgentReport>
  /** Each reading's own fingerprint, which is how the next poll tells WHICH of them moved. */
  sigs: Map<string, string>
  /** The whole list's, which is how it tells whether any of them did. */
  sig: string
}

export const NO_READINGS: Held = { list: [], byId: new Map(), sigs: new Map(), sig: '' }

/** One reading's fingerprint.
 *
 *  Covers what can CHANGE a wedge: that it exists, the body it was taken against, and the
 *  grades. Deliberately not `found` or `note` — they are paragraphs, and hashing a megabyte
 *  of prose twice a second to learn nothing is the cost this exists to avoid. A reading whose
 *  prose changed but whose grades did not paints identically. */
export function reportSignature(r: AgentReport): string {
  return `${r.id}|${r.at ?? ''}|${r.body ?? ''}|${r.predicted ?? ''}|${r.documented ?? ''}|${r.legible ?? ''}|${r.trap ?? ''}|${r.derivable ?? ''}|${r.legibleDated ?? ''}|${r.trapDated ?? ''}`
}

/** What a poll leaves the window holding, and whether folding it can change the picture.
 *
 *  FNV-1a over the per-reading fingerprints, which is what `assessment` uses on the Rust side
 *  for the same kind of job. The list's hash answers "did anything move"; the per-reading
 *  hashes answer "which", and that is the one that matters — one function turning hot leaves
 *  the other sixteen thousand readings exactly as they were, and they keep their objects so
 *  the fold below can hand back the wedges they belong to untouched. */
export function holdReadings(prev: Held, list: AgentReport[]): { held: Held; moved: boolean } {
  const sigs = list.map(reportSignature)
  let h = 0x811c9dc5
  for (const part of sigs) {
    for (let i = 0; i < part.length; i++) {
      h ^= part.charCodeAt(i)
      h = Math.imul(h, 0x01000193)
    }
  }
  const sig = `${list.length}:${h >>> 0}`
  if (sig === prev.sig) return { held: prev, moved: false }
  const kept = list.map((r, i) =>
    prev.sigs.get(r.id) === sigs[i] ? (prev.byId.get(r.id) ?? r) : r,
  )
  return {
    held: {
      list: kept,
      byId: new Map(kept.map((r) => [r.id, r])),
      sigs: new Map(list.map((r, i) => [r.id, sigs[i]])),
      sig,
    },
    moved: true,
  }
}

/** Every reading a ring's functions have, folded in as the ring is grafted.
 *
 *  The other half of `readInto`'s reason for existing: `filled` splices these into the tree
 *  after `applyAgentReports` has already run, so this is the only place their readings can
 *  reach them. Identity-preserving — an untouched ring comes back as the same array, which is
 *  what keeps the graft's memo from rebuilding the sunburst on every reading poll. */
export function readIntoRing(ring: Node[], byId: Map<string, AgentReport>): Node[] {
  let moved = false
  const out = ring.map((n) => {
    const next = readInto(n, byId.get(n.id))
    if (next !== n) moved = true
    return next
  })
  return moved ? out : ring
}

/** Two lists of readings that are the same readings, in the same order.
 *
 *  By IDENTITY and not by value: the poll hands back the object it handed back last time for
 *  every reading that has not moved (see `keepReadings`), so this is exact without hashing
 *  anything, and a reading whose grades actually changed is a different object. */
function sameReports(was: AgentReport[] | undefined, now: AgentReport[]): boolean {
  if (!was || was.length !== now.length) return false
  return was.every((r, i) => r === now[i])
}

export function applyAgentReports(root: Node, reports: AgentReport[]): Node {
  const byId = new Map(reports.map((r) => [r.id, r]))
  /** Readings grouped by the file they belong to, for files whose functions are absent.
   *
   *  A node id is `path#name@line`, so the path is everything before the first `#` — the
   *  same decomposition `key_of` makes on the other side. An orphan (`loc: 0`) is dropped
   *  here rather than downstream: its function no longer exists, and counting its lines
   *  would put code in a directory's breakdown that is not in the directory. */
  const byPath = new Map<string, AgentReport[]>()
  for (const r of reports) {
    const cut = r.id.indexOf('#')
    if (cut <= 0 || !r.loc) continue
    const path = r.id.slice(0, cut)
    const list = byPath.get(path)
    if (list) list.push(r)
    else byPath.set(path, [r])
  }
  const visit = (node: Node): Node => {
    if (node.children.length === 0) {
      // A file with functions it has not been sent carries their readings instead. Its own
      // reading still attaches below through `readInto` — a file's header grade and its
      // functions' grades are two different measurements.
      const held = node.kind === 'file' && node.funcs > 0 ? byPath.get(node.path) : undefined
      // Spliced in only when the list is not the one already there — member by member, on
      // identity, which the readings keep between polls when nothing about them moved. A
      // file whose functions have all been read holds every one of their readings here, so
      // rebuilding it unconditionally made every read FILE a new object on the poll's
      // period, and with it every directory above it. See `readInto`, which is the same
      // rule one level down.
      const carrying = held && !sameReports(node.pending, held) ? { ...node, pending: held } : node
      return readInto(carrying, byId.get(node.id))
    }
    const children = node.children.map(visit)
    const folded = children.every((c, i) => c === node.children[i])
      ? node
      : reaggregate(node, children)
    // A FILE can carry a reading of its own — see `Task.file`. It attaches, and it does
    // NOT touch the score: a file's temperature is the roll-up of what is inside it, and a
    // judgement about its header is a different measurement that must not overwrite one it
    // did not make. What reads it is the Docs lens, which asks the file about its own
    // header rather than averaging its functions, and the pane, which shows the reading.
    const own = byId.get(node.id)
    if (!own) return folded
    return { ...folded, agent: own, agentStale: isReportStale(own, node) }
  }
  return visit(root)
}

/**
 * The two things on the map that a color ramp cannot explain: hatched wedges and
 * uncolored ones.
 *
 * Counted off the tree rather than read from the project list so the legend always
 * describes the picture actually on screen — drilled into one directory, the repo-wide
 * number is annotating something nobody is looking at.
 *
 * **Scoped exactly like `summarize`, and that is the point of returning both from one
 * walk.** The panel gets its `unread` from `summarize`, which drops functions a
 * `.sanityignore` set aside; a legend that counted them would put a different number
 * beside the same word in two places on one screen, and the reader has no way to tell
 * which is lying. One definition, one traversal, no chance to drift.
 *
 * Deliberately cheap: no allocation beyond the result, no sorting. It runs on every render
 * of the legend, which includes every frame of a history replay, where `summarize`'s hot
 * and by-grade arrays would be thousands of pushes a frame.
 */
export function countPending(root: Node): { stale: number; unread: number } {
  let functions = 0
  let read = 0
  let stale = 0
  const walk = (n: Node, out: boolean) => {
    const outOfScope = out || n.excluded
    // **A file counts the functions it has not handed over, and the readings riding on it** —
    // `summarize`'s accounting, which this claimed to share and did not. Counted over function
    // nodes alone, the key described whichever rings had been fetched: one report of sanity
    // said 84 unread and the brief exported twelve seconds later said 99, of the same commit,
    // because the report's own zoomed pages had fetched more rings in between.
    if (!outOfScope && n.kind === 'file' && n.funcs > 0) {
      functions += n.funcs
      for (const r of n.pending ?? []) {
        if (r.stale) stale++
        else read++
      }
    }
    if (!outOfScope && n.kind === 'func') {
      functions++
      if (n.agentStale) stale++
      else if (n.agent) read++
    }
    for (const c of n.children) walk(c, outOfScope)
  }
  walk(root, false)
  // Derived, as `summarize` derives it, so the three add up to the total.
  return { stale, unread: Math.max(0, functions - read - stale) }
}

/** Temperature at which a function counts as hot. Mirrors `HOT` in `model.rs` — the
 *  number a directory's `hot_share` is a share OF, so a second copy that drifted would
 *  make the panel and the wedge it describes disagree about what "hot" means. */
export const HOT = 0.5

/**
 * What a subtree adds up to, for the panel that has no wedge to describe.
 *
 * Counted off the tree rather than taken from `ProjectSummary`, for the reason
 * `countStale` already is: drilled into one directory, a count of the whole repo is
 * annotating a picture nobody is looking at. The project row in the sidebar is the
 * repo-wide number and stays that way; this one describes what is on screen.
 *
 * `spread` counts only readings that still describe their code. Stale ones are their own
 * bucket and are NOT folded into a grade — the wedge has already stopped taking their
 * color, and a count that quietly included them would let the panel read as finished
 * while holding expired work, which is the one thing `assessed` exists to prevent.
 */
export interface RepoSummary {
  functions: number
  /** Functions a `.sanityignore` set aside. Never queued, so they can never be read —
   *  counting them as `unread` had the panel offering to connect an agent for work no
   *  reader will ever be handed, against a sidebar that already read 16925/16925.
   *  Reported beside `functions` rather than dropped: an exclusion nobody can count is
   *  how a map claims completeness over a subset somebody chose months ago. */
  excluded: number
  /** Current readings by grade — the four steps, as counts. */
  spread: Record<Grade, number>
  /** Functions holding a current reading: the sum of `spread`. */
  read: number
  /** Read once, but against a body that has since changed. */
  stale: number
  /** Never read by anybody. */
  unread: number
  /** Current readings above `HOT`, hottest first — what the map is pointing at. */
  hot: Node[]
  /** Every current reading, by the grade it came back with, hottest first within each.
   *
   *  The counts in `spread` were the whole of this and a count is where the panel stops
   *  being useful: "5,841 cold" is a fact you can do nothing with, and the reader who wants
   *  to know WHICH has only the map, which cannot spell. Node references, so the four lists
   *  together cost one pointer per function. */
  byGrade: Record<Grade, Node[]>
  /** Where to send someone who wants to deal with the expiries, or null if there are none. */
  firstStale: Node | null
  /** The second axis: how clear each body was once open.
   *
   *  Counted separately from `spread` and never merged with it. `predicted` asks whether
   *  the intent was reachable BEFORE opening; this asks what was there once it was. A repo
   *  can fail the first and pass the second — unnavigable but plain — and the gap between
   *  the two bars is the finding. Averaging them would delete exactly that. */
  legible: Record<Grade, number>
  /** Readings carrying a `legible` grade at all. The denominator for the bar above, which
   *  is NOT `read`: every reading banked before the field existed has no opinion, and a bar
   *  drawn against the wrong total would report those as a grade nobody gave. */
  legibleRead: number
  /** Readings whose reader said something there will bite the next person to edit it. */
  traps: number
  /** No `notes` list. A note is written ABOUT a function and reads as a sentence about
   *  nothing without the signature, docs and grades beside it — so it is shown on the
   *  function, in `Detail`, and nowhere a summary could stack forty of them. */
}

export function summarize(root: Node): RepoSummary {
  const s: RepoSummary = {
    functions: 0,
    excluded: 0,
    spread: { full: 0, most: 0, some: 0, none: 0 },
    read: 0,
    stale: 0,
    unread: 0,
    hot: [],
    byGrade: { full: [], most: [], some: [], none: [] },
    firstStale: null,
    legible: { full: 0, most: 0, some: 0, none: 0 },
    legibleRead: 0,
    traps: 0,
  }
  const walk = (n: Node, out: boolean) => {
    const outOfScope = out || n.excluded
    // **A file counts the functions it is holding but has not handed over.** `funcs` is the
    // count a file carries INSTEAD of its children — rings are fetched only for files wide
    // enough to draw an inside — so without this the total is not the subtree's, it is
    // whatever happened to be fetched. At the root of a large repo that is nothing, and the
    // panel came up blank; after drilling and coming back it was the subtree just visited,
    // printed under the repo's name. The count is the scan's own and does not depend on
    // where anybody has been looking.
    //
    // The reading counts used to stop here, at what was known of what was loaded; a file's
    // held readings now close that too — see just below. `unread` remains DERIVED from this
    // total rather than counted, so the three add up either way.
    if (n.kind === 'file' && n.funcs > 0) {
      if (outOfScope) s.excluded += n.funcs
      else {
        s.functions += n.funcs
        // **The readings of a file whose ring has not arrived.** The note below used to say
        // these could not be recovered — that a grade belongs to a function and an unfetched
        // one has none here — and that was true until the readings started riding on the
        // file (see `Node.pending`). At the root of a large repo this is the difference
        // between a Surprise breakdown that says "nothing has been read" and one that says
        // what was. `unread` is still derived from the total below, so the three add up
        // whether or not any of this fires.
        for (const r of n.pending ?? []) {
          if (r.stale) {
            s.stale++
          } else {
            const g = r.predicted ?? (r.surprised ? 'none' : 'full')
            s.spread[g]++
            s.read++
            const lg = legibleOf(r)
            if (lg) {
              s.legible[lg]++
              s.legibleRead++
            }
            if (trapOf(r)) s.traps++
          }
        }
      }
    }
    if (n.kind === 'func') {
      if (outOfScope) {
        s.excluded++
        n.children.forEach((c) => walk(c, outOfScope))
        return
      }
      s.functions++
      if (n.agentStale) {
        s.stale++
        if (!s.firstStale) s.firstStale = n
      } else if (n.agent) {
        const g = n.agent.predicted ?? (n.agent.surprised ? 'none' : 'full')
        s.spread[g]++
        s.byGrade[g].push(n)
        s.read++
        const lg = legibleOf(n.agent)
        if (lg) {
          s.legible[lg]++
          s.legibleRead++
        }
        if (trapOf(n.agent)) s.traps++
        if (temperature(n.score) > HOT) s.hot.push(n)
      }
    }
    n.children.forEach((c) => walk(c, outOfScope))
  }
  walk(root, false)
  // **Derived, so the three add up to the total.** It was counted per function, which made
  // it a count of the unread among the LOADED — and beside a `functions` total that is now
  // the subtree's real one, the arithmetic on screen would not close. Everything neither
  // read nor stale is unread, including the functions no ring has been fetched for, which
  // is exactly what they are.
  s.unread = Math.max(0, s.functions - s.read - s.stale)
  const hottestFirst = (a: Node, b: Node) =>
    temperature(b.score) - temperature(a.score) || b.loc - a.loc
  s.hot.sort(hottestFirst)
  for (const g of Object.keys(s.byGrade) as Grade[]) s.byGrade[g].sort(hottestFirst)
  return s
}

export async function scanRepo(path: string): Promise<Scan> {
  const w = await invoke<WireScan>('scan_repo', { req: { path } })
  return toScan(w)
}

/** A scan off the wire — see `toNode`. */
export function toScan(w: WireScan): Scan {
  return {
    root: toNode(w.root),
    stats: {
      filesScanned: w.stats.files_scanned,
      filesSkipped: w.stats.files_skipped,
      functions: w.stats.functions,
      withoutHistory: w.stats.without_history,
      commits: w.stats.commits ?? 0,
      // A backend that predates the ladder sends neither, and the pair defaults to "not
      // measured, on the full ladder" — which locks the lens rather than painting zeroes.
      churnWindows: w.stats.churn_windows ?? [30, 60, 90, 180],
      churned: w.stats.churned ?? false,
      tangleBands: w.stats.tangle_bands?.median ?? [],
      tangleOver: w.stats.tangle_bands?.over ?? [],
      authors: w.stats.authors ?? [],
      model: w.stats.model,
      callsResolved: w.stats.calls_resolved,
      callsUnresolved: w.stats.calls_unresolved,
    },
  }
}

/**
 * Roll child scores up one level. Mirrors `Node::aggregate` in model.rs and has to keep
 * mirroring it — they are the same arithmetic reached from opposite ends, and if they
 * drift the map disagrees with itself depending on whether you watched it fill in or
 * waited for the final tree.
 */
function reaggregate(node: Node, children: Node[]): Node {
  let w = 0
  let surprise = 0
  let documented = 0
  const churn: ChurnWindows = [0, 0, 0, 0]
  // Weighted by lines like everything else here, and over the children that HAVE an answer:
  // a file holding one Rust function and one in a language with no branch table is half
  // measured, and averaging the untaught half in as zero would report it as half as tangled.
  const tangle: [number, number] = [0, 0]
  let tw = 0
  let cognitive: number | null = null
  let hot = 0
  let analyzed = 0
  let age: number | null = null
  let touched: number | null = null
  /** The strongest instrument anything under here was measured with. */
  let src: Score['source'] = 'proxy'
  for (const c of children) {
    if (!c.score) continue
    const cw = Math.max(c.loc, 1)
    w += cw
    surprise += c.score.surprise * cw
    documented += c.score.documented * cw
    for (let i = 0; i < 4; i++) churn[i] += c.score.churn[i] * cw
    if (c.score.tangle) {
      tw += cw
      tangle[0] += c.score.tangle[0] * cw
      tangle[1] += c.score.tangle[1] * cw
    }
    // Summed, not averaged — a container's score is how many decisions are inside it.
    if (c.score.cognitive !== null) cognitive = (cognitive ?? 0) + c.score.cognitive
    if (c.kind === 'func') {
      if (c.score.source === 'model' || c.score.source === 'agent') {
        analyzed += cw
        if (temperature(c.score) > HOT) hot += cw
      }
    } else {
      const ca = c.score.analyzedShare * cw
      analyzed += ca
      hot += c.score.hotShare * ca
    }
    if (c.score.ageDays !== null) {
      age = age === null ? c.score.ageDays : Math.max(age, c.score.ageDays)
    }
    // ...and was last touched when the most recent thing in it was. This was hardcoded
    // `null` below, which is the same bug Rust's `aggregate` already fixed and this
    // copy never got: any subtree an agent reported on was re-aggregated here, lost its
    // last-touched date, and went gray in Age mode. The most-read directory in the repo
    // was the one that looked least measured.
    if (c.score.lastTouchedDays !== null) {
      touched =
        touched === null ? c.score.lastTouchedDays : Math.min(touched, c.score.lastTouchedDays)
    }
    // An aggregate is measured by the best instrument that reached anything inside it.
    // Hardcoding `proxy` made a directory built entirely from agent readings report
    // "heuristic (no model)" — the one misstatement the panel is not allowed to make,
    // in the row that exists to prevent it.
    if (c.score.source === 'agent') src = 'agent'
    else if (c.score.source === 'model' && src === 'proxy') src = 'model'
  }
  return {
    ...node,
    children,
    score:
      w > 0
        ? {
            surprise: surprise / w,
            documented: documented / w,
            churn: churn.map((c) => c / w) as ChurnWindows,
            ageDays: age,
            // Commits are NOT recomputed here: a directory has no single commit count
            // and summing children double-counts a commit that touched twelve files.
            // Rust fills it from the git log pass, which is the only place that still
            // knows the distinct set — so carry that value rather than zeroing it, or
            // every re-aggregated directory reports zero commits while its churn bar
            // sits at 72.
            commits: node.score?.commits ?? [0, 0, 0, 0],
            tangle: tw > 0 ? [tangle[0] / tw, tangle[1] / tw] : null,
            cognitive,
            // Carried for the same reason and with the same danger: a directory's total
            // counts a commit once, and summing children would count it once per file.
            allCommits: node.score?.allCommits ?? null,
            lastTouchedDays: touched,
            provenance: 'source',
            hotShare: analyzed > 0 ? hot / analyzed : 0,
            source: src,
            analyzedShare: analyzed / w,
          }
        : node.score,
  }
}

/** Stop the replay that is running. What it reached is kept and can be resumed — see
 *  `history::cancel`. */
export function stopHistory(): Promise<void> {
  return invoke<void>('stop_history')
}

/** A tick, and the project it is about — see `scan::Tick`. */
interface Tick {
  project: string
  progress: Progress
}

export function onScanProgress(cb: (project: string, p: Progress) => void): () => void {
  const un = listen<Tick>('scan-progress', (e) => cb(e.payload.project, e.payload.progress))
  return () => void un.then((f) => f())
}

/** The app menu's View → Appearance items. Rust owns the checkmarks, this owns the
 *  preference and its persistence — neither keeps a copy of the other's state. */
export function onSetTheme(cb: (theme: string) => void): () => void {
  const un = listen<string>('set-theme', (e) => cb(e.payload))
  return () => void un.then((f) => f())
}

/** The app menu's File → Add Project… (⌘O). */
export function onOpenProject(cb: () => void): () => void {
  const un = listen('open-project', () => cb())
  return () => void un.then((f) => f())
}

/** The app menu's File → Export Report as PDF… (⇧⌘E). */
export function onExportReport(cb: () => void): () => void {
  const un = listen('export-report', () => cb())
  return () => void un.then((f) => f())
}

/** What `sanity` means in a terminal, and whether it is THIS app. Read-only.
 *
 *  `on_path` alone is the answer that goes wrong: two installs of Sanity can both put a
 *  `sanity` on PATH — a Homebrew cask's and this app's — and the one that wins is a fact
 *  about PATH order, not about which window you are looking at. */
export interface CliState {
  linked: boolean
  path: string | null
  on_path: boolean
  /** What a shell would actually run, followed through the symlink. */
  resolved: string | null
  /** Whether that is this app's binary. */
  is_this_app: boolean
}

export function cliStatus(): Promise<CliState> {
  return invoke<CliState>('cli_status').catch(() => ({
    linked: false,
    path: null,
    on_path: false,
    resolved: null,
    is_this_app: false,
  }))
}

/** The app menu's Sanity → Install Command Line Tool…. */
export function onInstallCli(cb: () => void): () => void {
  const un = listen('install-cli', () => cb())
  return () => void un.then((f) => f())
}

/** Tick the appearance item matching what we're actually using. The menu is built before
 *  the webview reads localStorage, so it would otherwise always show System. */
export function syncThemeMenu(theme: string): Promise<void> {
  return invoke<void>('sync_theme_menu', { theme }).catch(() => {})
}

// ── Derived reads of a score ────────────────────────────────────────────────────
//
// These live here, next to the types, so the sunburst and the detail panel can never
// disagree about what a color means.

/** What the wedge is colored by.
 *
 *  Just the surprise now. Documentation reaches the instrument rather than the
 *  arithmetic — the model gets the comment stack in its prompt, and an agent reads the
 *  docs before it predicts — so a well-documented function is cold because the reader
 *  was not surprised, not because a multiplier discounted a surprise it still reported.
 *  Keeping it as a function because this is THE number the color means, and it has
 *  changed definition once. */
export function temperature(s: Score | null): number {
  if (!s) return 0
  return Math.max(0, Math.min(1, s.surprise))
}

/**
 * Why *this* wedge got *that* verdict, in facts about this code.
 *
 * The panel used to print a fixed paragraph per quadrant, which read identically for
 * every function in the repo and so answered "it's trouble, but why?" with a horoscope.
 * A verdict is only useful with its reasons attached, and the reasons have to be the
 * actual numbers that produced it.
 *
 * Raw counts, not normalized scores: "changed 14 times since May" is something a person
 * can check and act on; "churn 100%" is a percentage of a saturation constant they have
 * never heard of.
 */

/**
 * What a wedge is actually colored by, which depends on what the wedge IS.
 *
 * A function shows its own temperature. A file, a directory, or an overflow roll-up shows
 * the *share* of its lines that are hot — because averaging temperature over hundreds of
 * functions converges on the repo mean, and every inner ring, which is most of the picture
 * by area, comes out the same lukewarm color. That was the first screenshot.
 *
 * The two readings stay compatible: both answer "how much of what I'm looking at needs
 * my attention", one for a single body and one for a collection.
 */
export function wedgeHeat(node: Node): number {
  if (!node.score) return 0
  return showsShare(node) ? node.score.hotShare : temperature(node.score)
}

/**
 * Where a hot SHARE sits on the ramp — the calibration, not the measurement.
 *
 * A share and a temperature both run 0..1 and are not the same scale. Real directories
 * do not use the top of theirs: measured line-weighted across tonepoet, sanity and
 * ComfyUI, 37 directories run from 0.0% to 37.8% hot with a median of 5.9%, so on the raw
 * number 35 of the 37 land in the bottom fifth of the ramp and every folder in the window
 * is the same gray. That is the same failure a flat histogram is for the proxy: the scale
 * looks like a measurement and reports a constant.
 *
 * `min(1, share/BAND)^SKEW` with the constants below puts the p10–p90 across 0.80 of the
 * ramp against 0.18 raw, and saturates exactly one directory — tonepoet's
 * `pipeline/qualification` at 37.8%, which is genuinely extreme. A tighter band scores
 * better on spread and saturates six, and a saturated top is the point where the ranking
 * stops being a ranking.
 *
 * Two properties this is not allowed to lose. It is MONOTONIC, so it changes no ordering —
 * which is why `wedgeHeat` above is left raw for sorting and for the numbers the panel
 * prints, and this is applied only where a color is produced. And `0` maps to `0`, so a
 * directory with nothing hot in it still reads as nothing hot: ComfyUI has six of those,
 * and a scale that lifted them off the floor could not say that anything was fine.
 *
 * Constants are a standing claim about real repos, like `heuristic::calibrate`'s. Re-run
 * the measurement across several before moving them.
 */
const SHARE_BAND = 0.25
const SHARE_SKEW = 0.7

export function shareRamp(share: number): number {
  return Math.pow(Math.min(1, Math.max(0, share) / SHARE_BAND), SHARE_SKEW)
}

/** What a wedge is PAINTED with: `wedgeHeat`, with a share put on the ramp's own scale.
 *  Separate from `wedgeHeat` because that one is the reported quantity — the tooltip's
 *  "9% hot" is the measurement and this is where it lands on the color bar. */
export function paintHeat(node: Node): number {
  if (!node.score) return 0
  return showsShare(node) ? shareRamp(node.score.hotShare) : temperature(node.score)
}

/**
 * Has anything actually looked at this wedge?
 *
 * Wedges the model hasn't reached render neutral rather than borrowing the offline
 * proxy's guess. That proxy is measurably close to sorting by line count — `just scan`
 * prints the baseline check that says so — so painting heat with it states a finding the
 * numbers don't support. Gray is not a gap in the picture; it is the picture telling you
 * what it has and hasn't examined, which is the honest thing for a comprehension tool to
 * be able to say about itself.
 */
export function isAnalyzed(node: Node): boolean {
  if (!node.score) return false
  return showsShare(node)
    ? node.score.analyzedShare > 0
    : node.score.source === 'model' || node.score.source === 'agent'
}

/** Which ramp a reading walks. Each is five CSS stops of a single hue, sharing one
 *  lightness profile — see index.css. */
export type Ramp = 'heat' | 'legible' | 'churn' | 'age' | 'docs' | 'reach' | 'callers' | 'tangle'

/** Interpolate a ramp's five CSS stops. Returns a `var(...)` mix so the ramps stay
 *  defined in one place (index.css) and re-theme with the rest of the app. */
export function heatColor(t: number, ramp: Ramp = 'heat'): string {
  const { stops, i, f } = rampAt(t, ramp)
  return `color-mix(in oklch, var(${stops[i + 1]}) ${Math.round(f * 100)}%, var(${stops[i]}))`
}

/**
 * The stop a mixed ramp color is NEAREST to, as a bare custom-property name.
 *
 * For anyone who has to know how dark the fill actually came out — `inkOn` does, to pick
 * a label color. A `color-mix()` string is not something JavaScript can read back: the
 * mix happens in the renderer, in oklch, and nothing exposes the result. Rounding to the
 * nearer of the two stops sidesteps it entirely, and costs nothing worth having, because
 * the decision this feeds is a binary one and the two candidate stops sit a fifth of a
 * ramp apart — the mixes that round the "wrong" way are the ones sitting on the flip,
 * where either answer is within a few percent of the other.
 */
export function rampStop(t: number, ramp: Ramp = 'heat'): string {
  const { stops, i, f } = rampAt(t, ramp)
  return stops[f < 0.5 ? i : i + 1]
}

function rampAt(t: number, ramp: Ramp) {
  const stops = [0, 1, 2, 3, 4].map((i) => `--${ramp}-${i}`)
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x))
  return { stops, i, f: x - i }
}
