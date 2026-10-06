import type { ChurnWindows, Folded, Node, TangleRow, TimeRow } from './api'
import { KIND_ORDER, tangleRamp } from './colorMode'
import {
  CHURN_MEMORY,
  NO_AT,
  NO_COG,
  NO_GRADE,
  NO_TS,
  authorName,
  daysBetween,
  type Frame,
} from './historyFrame'
import {
  KIND_SLOTS,
  flashOnly,
  inStep,
  kindSlot,
  placeOf,
  readingInto,
  scoreInto,
} from './historyScore'
import { pathIndexOf, scopeOf, shapeOf, type Shape } from './historyShape'
import type { Tables } from './timeline'

/**
 * The node tree for one frame, built top-down into pooled nodes.
 *
 * The phases `frameTree` runs in order, each reading what the last wrote into a `Build`: size
 * every file from its live functions, total those sizes up the directory chain, then descend
 * from the root while a subtree is worth drawing. What is too thin to draw is rolled into a
 * stand-in — one per file, one per directory — carrying a tally of what it folded, so a
 * roll-up can answer the lens it stands in for. The nodes themselves are pooled per timeline
 * and mutated frame to frame; only the root is new.
 */

/** Fold a directory that holds exactly one directory into its child, so `src/tauri/src`
 *  is one ring rather than three. The scan does this and the two pictures have to have
 *  the same shape, or scrubbing to HEAD would visibly restructure the repo. */
export function collapse(node: Node): Node {
  // In place. It was `children.map(collapse)`, which allocates an array per container per
  // frame — invisible next to the nodes themselves until those were pooled, and then the
  // largest thing left. A chain that collapses still yields a fresh node, which is right:
  // it is a different subject from either of the two it replaces, and there are few of them.
  const kids = node.children
  for (let i = 0; i < kids.length; i++) {
    const done = collapse(kids[i])
    if (done !== kids[i]) kids[i] = done
  }
  if (node.kind === 'dir' && kids.length === 1 && kids[0].kind === 'dir') {
    const only = kids[0]
    return { ...only, name: `${node.name}/${only.name}` }
  }
  return node
}

export function dirNode(path: string, name: string): Node {
  return {
    id: path,
    name,
    kind: 'dir',
    path,
    callers: null,
    calls: null,
    incident: null,
    away: null,
    resolvable: null,
    orphans: null,
    sinks: null,
    // A frame is a past commit and the timeline carries no wiring, so all three are the
    // absence rather than a zero — which is why Testing is a `live` lens: replayed, it says
    // it cannot be replayed instead of drawing every wedge as untested.
    dependents: null,
    underTest: null,
    tested: null,
    codeKind: null,
    cloneGroup: null,
    cloneSize: null,
    comparable: null,
    copied: null,
    loc: 0,
    line: null,
    endLine: null,
    bytes: null,
    lang: null,
    excluded: false,
    lastAuthor: null,
    mainAuthor: null,
    headcount: null,
    // Never a doc. History replays the commit stream's structure — see the module note on
    // what a frame is allowed to claim — and a comment is a reading's input, not a fact
    // about a commit.
    doc: null,
    signature: null,
    owner: null,
    score: null,
    body: null,
    hotspots: [],
    children: [],
    funcs: 0,
  }
}

/** Every node a frame draws, reused frame to frame.
 *
 *  A frame of tonepoet is seventeen thousand functions, each with a `Score`, and building
 *  them fresh thirty times a second is a million objects a second handed straight to the
 *  collector — which showed up exactly as it sounds: a smooth replay with a hitch in it on
 *  a period nobody chose. Nodes are pooled and MUTATED instead.
 *
 *  **Containers were left out of this, and the reason inverted on a large repo.** The
 *  argument was that the sunburst recomputes its layout when the node it is ROOTED at
 *  changes identity, so a stable root would freeze the map — which is exactly right about
 *  the root and does not reach its children: `layout` walks the tree afresh every time it
 *  runs, and every memo downstream keys on the root. So the root is still allocated per
 *  frame, one object, and everything under it is held here.
 *
 *  What made it worth doing is that the saving was measured on the wrong half. `minLoc`
 *  rolls a function up before a node exists, and on a 4.2M-line repo the cut is a thousand
 *  lines — so nearly every function is folded away and the frame is almost entirely
 *  containers. Sixty thousand files and their stand-ins, at about twenty-five fields each,
 *  against a pooled population of nearly nothing: measured at 117ms a frame to BUILD, where
 *  folding six hundred commits into it cost 33ms.
 *
 *  Keyed by the timeline it belongs to, so switching projects cannot hand one repo's nodes
 *  to another's tree. */
interface Pool {
  hist: Tables
  nodes: Map<number, Node>
  dirs: Map<string, Node>
  files: Map<number, Node>
  /** The per-file roll-up stand-ins — see where they are built. */
  folded: Map<number, Node>
  /** ...and the per-DIRECTORY ones, for the files a ring has no room for. */
  crowd: Map<number, Node>
}
let pool: Pool | null = null

/** Ready a pooled container for this frame.
 *
 *  Everything a frame DERIVES is cleared; everything that is a property of the path is left
 *  alone. `id`, `path`, `name`, `kind` and `lang` are the second kind — a file does not
 *  change its name between commits — and rewriting them every frame is the allocation this
 *  exists to avoid, wearing a different hat.
 *
 *  `score` is cleared rather than kept for `aggregate` to overwrite, because `aggregate`
 *  can decline to write one: a container whose children carry no score at all leaves it
 *  untouched, and a stale score from six hundred commits ago is the worst of both — it
 *  reads as current and describes a frame that has gone. */
function reuse(node: Node): Node {
  node.children.length = 0
  node.loc = 0
  node.score = null
  node.birthBelow = undefined
  node.touchBelow = undefined
  return node
}

/**
 * One frame's tree while it is being built: what `frameTree` was asked for, the cuts derived
 * from it, and the dense per-file and per-directory totals each phase writes for the next.
 *
 * Every field here was a local of `frameTree` when it was one long body; they travel as one
 * value so the phases can be named functions rather than closures over that body. One object
 * per frame — the arrays inside it were already allocated per frame, and none of it is a node.
 */
interface Build {
  hist: Tables
  frame: Frame
  since: number
  windows: ChurnWindows
  /** **One yardstick for the whole replay**, so a wedge changes colour when its body changes
   *  and at no other time — see `Tables.tangleBands`. Read off the timeline rather than
   *  threaded from a caller: it is a property of the timeline, like the paths and the
   *  languages beside it. */
  bands: (number | null)[] | undefined
  held: Pool
  shape: Shape
  scope: string
  /** Lines a function needs before it gets a node of its own — see `startBuild`. */
  minLoc: number
  /** The same rule asked about what is actually being drawn — see `frameTree`'s `scope`. */
  inScope: Set<number> | null
  scopeMin: number
  /** Lines and count rolled up per file, for the stand-in wedges.
   *
   *  **Dense arrays rather than maps, because a path IS an index.** These are written once
   *  per live function and read once per live file, and as maps that is a hash into a table
   *  the size of the repo — 148,000 lookups against 60,000 keys, which is the pointer chase
   *  the measurement found: sixty thousand files alone cost 10ms a frame and a hundred and
   *  forty-eight thousand functions alone cost 17ms, but together they cost 97ms. That
   *  superlinearity is not work, it is cache misses, and `hist.paths` is already a dense
   *  index that makes it go away. */
  restLoc: Float64Array
  restCount: Uint32Array
  /** ...and whether anything folded into that stand-in flashed on this frame.
   *
   *  Without this a replay of a large repo shows nothing at all. `minLoc` drops a function
   *  before it is ever a node, and on a repo the size of home-assistant it drops every one
   *  of them — so the commit under the playhead had nowhere to land and the map sat grey
   *  while the log scrolled past. The stand-in is what the fold left standing in for that
   *  function, so it is what carries the event. */
  restBirth: Uint8Array
  restEdit: Uint8Array
  /** Every live line in each file, drawn or rolled up. The totals are what the top-down
   *  walk thresholds against. */
  fileLoc: Float64Array
  // **The file's own answer to Complexity, totalled in the same pass that sizes it.** The
  // fold needs it at FILE resolution — a rolled-up directory has no functions on screen to
  // ask — and the live map computes exactly this in `Node::aggregate`: the ramp positions are
  // a LOC-weighted mean over the functions that could be counted (`fileTanW`, weighted by
  // `fileTanLoc`, which is NOT `fileLoc`), and the counts are summed.
  fileCog: Float64Array
  fileTan0: Float64Array
  fileTan1: Float64Array
  fileTanLoc: Float64Array
  // **Composition's answer at FILE resolution, for the same reason.** Lines by kind, one run
  // of `KIND_SLOTS` per path: Rust keeps its tests in the file they test, so a file is a mix
  // and the fold has to carry the mix rather than one kind. `restKind` is the same for the
  // thin functions a drawn file's stand-in holds.
  fileKind: Float64Array
  restKind: Float64Array
  /** The functions that earned their own node, per file — what a drawn file hangs off
   *  itself. */
  drawn: Map<number, Node[]>
  /** Live lines and live files under each directory, and whether anything under it flashed
   *  — see `sizeDirs`. */
  dirLoc: Float64Array
  dirFiles: Uint32Array
  dirBirth: Uint8Array
  dirEdit: Uint8Array
  /** The directories on the way to the scope, which are drawn whatever their size — see
   *  `sizeDirs`. */
  forced: Set<number>
}

/** The pool for this timeline, made fresh when the timeline is not the one it holds. */
function poolFor(hist: Tables): Pool {
  if (!pool || pool.hist !== hist) {
    pool = {
      hist,
      nodes: new Map(),
      dirs: new Map(),
      files: new Map(),
      folded: new Map(),
      crowd: new Map(),
    }
  }
  return pool
}

/** Everything a frame's build needs before its first phase: the pool and shape it builds
 *  into, the roll-up cuts, and the zeroed totals the phases fill. */
export function startBuild(
  hist: Tables,
  frame: Frame,
  since: number,
  scope: string,
  density: number,
  windows: ChurnWindows,
): Build {
  const held = poolFor(hist)
  const shape = shapeOf(hist)

  /** Lines a function needs before it gets a node of its own.
   *
   *  **The band cannot draw ninety-four thousand wedges and the frame should not build
   *  them.** Measured at ceph's size, folding one commit and building the tree cost 31.7ms
   *  a frame — the fold was 0.1 of that and the rest was this loop, an aggregate walk and a
   *  collapse walk over every live function, thirty times a second. What the layout then did
   *  with them is the tell: it drops any wedge too thin to see and rolls the remainder into
   *  a `126+` stand-in. So the cut moves here, where it saves the work instead of paying for
   *  it first.
   *
   *  A share of the frame's own lines rather than a fixed count, because the question is
   *  whether a wedge would be visible and the answer is relative to the whole circle.
   *  `frame.lines / 4000` is roughly a wedge of a twentieth of a degree.
   *
   *  A repo small enough for its functions to be drawn keeps every one of them: on anything
   *  under a few thousand functions the threshold lands below one line and nothing is
   *  rolled up. */
  const minLoc = frame.lines / (4000 * density * density)
  /** The same rule asked about what is actually being drawn — see `scope`. */
  const inScope = scope ? scopeOf(hist, scope) : null
  let scopeLines = 0
  if (inScope) {
    for (const f of frame.order) {
      if (inScope.has(hist.funcs[f].path)) scopeLines += frame.loc[f]
    }
  }
  const scopeMin = inScope && scopeLines > 0 ? scopeLines / (4000 * density * density) : minLoc

  const files = hist.paths.length
  const dirs = shape.path.length
  return {
    hist,
    frame,
    since,
    windows,
    bands: hist.tangleBands?.median,
    held,
    shape,
    scope,
    minLoc,
    inScope,
    scopeMin,
    restLoc: new Float64Array(files),
    restCount: new Uint32Array(files),
    restBirth: new Uint8Array(files),
    restEdit: new Uint8Array(files),
    fileLoc: new Float64Array(files),
    fileCog: new Float64Array(files),
    fileTan0: new Float64Array(files),
    fileTan1: new Float64Array(files),
    fileTanLoc: new Float64Array(files),
    fileKind: new Float64Array(files * KIND_SLOTS),
    restKind: new Float64Array(files * KIND_SLOTS),
    drawn: new Map<number, Node[]>(),
    dirLoc: new Float64Array(dirs),
    dirFiles: new Uint32Array(dirs),
    dirBirth: new Uint8Array(dirs),
    dirEdit: new Uint8Array(dirs),
    forced: new Set<number>(),
  }
}

/** Every live function into its file's totals, and a pooled node for each one thick enough
 *  to be drawn; the rest roll into their file's stand-in. */
export function sizeFiles(b: Build): void {
  const { hist, frame, since, bands, inScope, scopeMin, minLoc, drawn } = b
  const { fileLoc, fileKind, fileCog, fileTan0, fileTan1, fileTanLoc } = b
  const { restLoc, restKind, restCount, restBirth, restEdit } = b
  // In interned order — see `Frame.order`, which is kept that way as commits land rather
  // than rebuilt here.
  for (const f of frame.order) {
    const loc = frame.loc[f]
    const def = hist.funcs[f]
    // Ignored means ignored, in the replay as on the live map. The trace still holds them —
    // pruning at the walk would mean re-tracing a large repo whenever the file changed — so
    // they are dropped here, where the picture is built. See `Tables.excluded`.
    if (hist.excluded[def.path]) continue
    fileLoc[def.path] += loc
    const ks = def.path * KIND_SLOTS + kindSlot(def.kind)
    fileKind[ks] += loc
    const score = frame.cog[f]
    if (score !== NO_COG) {
      const [w0, w1] = tangleRamp(bands, frame.nc[f], score)
      const cw = Math.max(loc, 1)
      fileCog[def.path] += score
      fileTan0[def.path] += w0 * cw
      fileTan1[def.path] += w1 * cw
      fileTanLoc[def.path] += cw
    }
    // Too thin to draw. Its lines still count — they reach the file wedge through the
    // stand-in below, so a file is the size it is whatever its inside looks like.
    if (loc < (inScope && inScope.has(def.path) ? scopeMin : minLoc)) {
      restLoc[def.path] += loc
      restKind[ks] += loc
      restCount[def.path] += 1
      const bornAt = frame.bornAt[f]
      const editAt = frame.editedAt[f]
      if (bornAt !== NO_AT && inStep(bornAt, since, frame.at)) restBirth[def.path] = 1
      if (editAt !== NO_AT && inStep(editAt, since, frame.at)) restEdit[def.path] = 1
      continue
    }
    const node = funcNodeFor(b, f, loc)
    const list = drawn.get(def.path)
    if (list) list.push(node)
    else drawn.set(def.path, [node])
  }
}

/** The pooled node for function `f`, made the first time it is drawn and brought up to this
 *  frame every time after. */
function funcNodeFor(b: Build, f: number, loc: number): Node {
  const { hist, frame } = b
  const def = hist.funcs[f]
  let node = b.held.nodes.get(f)
  if (!node) {
    node = {
      id: `${hist.paths[def.path]}#${def.name}#${f}`,
      name: def.name,
      kind: 'func',
      path: hist.paths[def.path],
      doc: null,
      signature: null,
      owner: null,
      loc,
      line: null,
      endLine: null,
      bytes: null,
      // From the path table rather than from the file NODE, which does not exist yet: the
      // functions are collected first and the file is built around them only if the
      // picture has room for it.
      lang: hist.langs[def.path] || null,
      excluded: false,
      lastAuthor: null,
      mainAuthor: null,
      headcount: null,
      score: null,
      body: null,
      hotspots: [],
      // A replay has no wiring, and never will. Resolving calls needs every file in the
      // repo as it stood at that commit, and the walk carries parse state forward rather
      // than re-parsing the tree — so the honest answer is the one the module already
      // gives for surprise: this is a second VIEW, not a second measurement, and a lens
      // it cannot compute stays gray rather than being stamped with today's answer.
      // The switcher is disabled during a replay anyway; this is what makes that true
      // rather than merely enforced.
      callers: null,
      calls: null,
      incident: null,
      away: null,
      resolvable: null,
      orphans: null,
      sinks: null,
      // A frame is a past commit and the timeline carries no wiring, so all three are the
      // absence rather than a zero — which is why Testing is a `live` lens: replayed, it says
      // it cannot be replayed instead of drawing every wedge as untested.
      dependents: null,
      underTest: null,
      tested: null,
      // Not wiring: what the body IS, placed by the walk from its own latest version — see
      // `HistoryFunc.kind`.
      codeKind: placeOf(def.kind),
      cloneGroup: null,
      cloneSize: null,
      comparable: null,
      copied: null,
      children: [],
      funcs: 0,
    }
    b.held.nodes.set(f, node)
  }
  // Only what a frame can change. Identity, path and language are properties of the
  // function, not of the moment — a pooled node that rewrote them every frame would be
  // a fresh allocation wearing a cache's clothes.
  node.loc = loc
  // **Its own last committer, or none.** Falling back to the file's would put an author on
  // every function in a file somebody touched, which is the thing this replaced. A function
  // from the truncated prefix has no author for the same reason it has no touch date: the
  // commit that wrote it is outside the window, and the honest answer is that we do not know.
  node.lastAuthor = authorName(hist, frame.funcAuthor[f])
  const packed = frame.graded[f]
  node.score = scoreInto(node.score, frame, f, b.since, packed, b.windows, b.bands)
  // The reading itself, for the two lenses that read it as a report rather than as a
  // number. Cleared when this frame has none, or a pooled node keeps the last one's.
  node.agent = packed === NO_GRADE ? undefined : readingInto(node.agent ?? null, packed)
  node.agentStale = false
  return node
}

/** Live lines and live files under each directory, and whether anything under it flashed.
 *
 *  **This is what makes the walk below top-DOWN.** The tree used to be built bottom-up
 *  from every live function, which meant a node per live file whatever the picture had
 *  room for: sixty thousand of them on kibana, to draw about two hundred wedges, with an
 *  aggregate and a collapse pass over all of it thirty times a second. Totals first, then
 *  descend only where there is something to see.
 *
 *  One add per ancestor per live file — a depth of eight on the deepest repos here — where
 *  the old shape paid a node, a score and two walks. */
export function sizeDirs(b: Build): void {
  const { frame, since, shape, fileLoc, restBirth, restEdit } = b
  const { dirLoc, dirFiles, dirBirth, dirEdit } = b
  for (let p = 0; p < fileLoc.length; p++) {
    const lines = fileLoc[p]
    if (lines <= 0) continue
    const born = frame.pathBornAt[p]
    const birth = restBirth[p] === 1 || (born !== NO_AT && inStep(born, since, frame.at))
    const edit = restEdit[p] === 1
    for (const a of shape.ancestors[p]) {
      dirLoc[a] += lines
      dirFiles[a] += 1
      if (birth) dirBirth[a] = 1
      if (edit) dirEdit[a] = 1
    }
  }

  /** The directories on the way to the scope, which are drawn whatever their size.
   *
   *  A drilled view resolves its own root by id against this tree, so pruning the chain that
   *  reaches it would leave the window looking for a node that is not there. The scope is
   *  also the one place a small directory is certainly worth drawing: somebody asked for it
   *  by name. */
  const scope = b.scope
  if (scope) {
    for (let d = 0; d < shape.path.length; d++) {
      if (shape.path[d] === scope || scope.startsWith(`${shape.path[d]}/`)) b.forced.add(d)
    }
  }
}

/** The pooled node for directory `d`, readied for this frame. */
function dirNodeFor(b: Build, d: number): Node {
  const path = b.shape.path[d]
  const had = b.held.dirs.get(path)
  if (had) return reuse(had)
  const made = dirNode(path, b.shape.name[d])
  b.held.dirs.set(path, made)
  return made
}

/** The pooled node for file `p`, readied for this frame and hung with its drawn functions
 *  and, when anything was too thin to draw, their stand-in. */
function fileNodeFor(b: Build, p: number): Node {
  const { hist, held } = b
  const path = hist.paths[p]
  const had = held.files.get(p)
  const made = had
    ? reuse(had)
    : {
        ...dirNode(path, path.slice(path.lastIndexOf('/') + 1)),
        kind: 'file' as const,
        lang: hist.langs[p] || null,
      }
  if (!had) held.files.set(p, made)
  // The one field a file derives from the FRAME rather than from the path — see the
  // stand-in below, which takes the same value for the same reason.
  made.lastAuthor = authorName(hist, b.frame.author[p])
  for (const fn of b.drawn.get(p) ?? []) made.children.push(fn)
  if (b.restLoc[p] > 0) made.children.push(standIn(b, p, b.restLoc[p], b.restCount[p]))
  return made
}

/** One stand-in per file for everything too thin to draw, in the shape the layout already
 *  makes for the same reason — see `rest` in `sunburst.ts`. It carries no children: those
 *  exist to be listed in the panel, and a frame's are a thousand objects a person cannot
 *  read while the story is running. */
function standIn(b: Build, p: number, lines: number, count: number): Node {
  const { hist, held } = b
  const path = hist.paths[p]
  const kept = held.folded.get(p)
  const stand: Node =
    kept ??
    ({
      // **`#/folded`, and it must never be `#/rest`.** `tileFunctions` mints `${path}#/rest`
      // for the members IT cannot draw — and in a replay the members it is handed include
      // this stand-in, so both nodes arrived in one file's patch list under one id. React's
      // answer to a duplicate key is that children "may be duplicated and/or omitted": it
      // duplicated one, lost track of the copy, and never rendered it again. That copy is
      // the ghost — a wedge frozen at the commit it was born on, sitting outside the rings
      // while the map moves under it, cleared only by a remount.
      //
      // The `/` is the third party to that argument: a real function's id is `key_of`'s
      // `path#name`, so a file holding a function named `folded` mints this exact string
      // and neither roll-up is safe from it. No identifier in any language here can contain
      // a slash, which makes the two synthetic namespaces unreachable from the real one.
      ...dirNode(`${path}#/folded`, `${count}+`),
      kind: 'func' as const,
      path,
      lang: hist.langs[p] || null,
    } as Node)
  if (!kept) held.folded.set(p, stand)
  stand.name = `${count}+`
  stand.loc = lines
  stand.rest = count
  // **The file's own last committer, which is the resolution this node HAS.** Putting a
  // file's author on each of forty functions is wrong about thirty-nine; this is not one
  // of forty, it IS the file, standing in for everything the picture has no room to draw.
  stand.lastAuthor = authorName(hist, b.frame.author[p])
  stand.score = flashOnly(b.restBirth[p] === 1, b.restEdit[p] === 1)
  // Its own file's answer, in the shape a crowd's takes. It could be read off `lang` and
  // `lastAuthor` instead — this stand-in IS one file — but then `contribute` would need two
  // rules for one kind of node, and the one it reached for would depend on which sort of
  // roll-up had been built. One rule, one field.
  const t = tallyOf()
  tallyFile(b, t, p, lines, b.restKind)
  stand.folded = settle(t)
  return stand
}

/** And one per DIRECTORY for the files too thin to draw, which is the same rule one ring
 *  out and the whole reason a frame is now proportional to the picture.
 *
 *  Drawn as a file rather than as a directory: it holds no functions and can be descended
 *  into by nobody, which is what a file wedge with a roll-up count already means. The
 *  layout was throwing these away anyway — the "9,022 files too thin" note in the corner
 *  IS this population — so what changes is that the fold stops building them first. */
function crowd(
  b: Build,
  d: number,
  lines: number,
  count: number,
  birth: boolean,
  edit: boolean,
  /** What it stands for, by value — see `Node.folded`. */
  folded: Folded,
): Node {
  const path = `${b.shape.path[d]}#/files`
  const kept = b.held.crowd.get(d)
  const stand: Node =
    kept ??
    ({
      ...dirNode(path, ''),
      kind: 'file' as const,
      path: b.shape.path[d],
    } as Node)
  if (!kept) b.held.crowd.set(d, stand)
  stand.name = `${count.toLocaleString()} files`
  stand.loc = lines
  stand.rest = count
  stand.lastAuthor = null
  stand.score = flashOnly(birth, edit)
  // **The one thing it CAN say.** It has no author and no language of its own — it is a
  // hundred files — but it knows which languages and which people its lines belong to, and
  // a distribution built without that describes whatever was big enough to draw and calls
  // it the whole directory.
  stand.folded = folded
  return stand
}

/**
 * What a roll-up stands for, gathered as it is rolled up — see `Node.folded`.
 *
 * **Per FILE, and that is the whole reason this is affordable.** A language and an author
 * are facts about a file, so a fold that already visits every file it drops can total them
 * on the way past: the cost is one map hit per folded file, against the alternative of
 * materialising per-function columns for everything the picture is not drawing, which is
 * the work the fold exists to avoid. It is also the resolution the LIVE map uses whenever a
 * file's ring has not arrived — a file's author and its language are its own — so the two
 * pictures answer at the same grain rather than one of them guessing finer.
 */
function tallyOf() {
  return {
    lang: new Map<string, number>(),
    author: new Map<string, number>(),
    kind: new Map<string, number>(),
    time: [] as number[],
    tangle: [] as number[],
  }
}
type Tally = ReturnType<typeof tallyOf>

/** One file's lines into a tally, under each value the file answers for every lens a
 *  roll-up can speak to. Its `kinds` are `fileKind` for a whole file and `restKind` for a
 *  drawn file's stand-in — the run that sums to `lines`. */
function tallyFile(b: Build, t: Tally, p: number, lines: number, kinds: Float64Array): void {
  const { hist, frame, windows } = b
  const kb = p * KIND_SLOTS
  for (let k = 0; k < KIND_SLOTS; k++) {
    const n = kinds[kb + k]
    if (n <= 0) continue
    const key = k < KIND_ORDER.length ? KIND_ORDER[k] : 'unplaced'
    t.kind.set(key, (t.kind.get(key) ?? 0) + n)
  }
  // Complexity first, because it is the shortest: the file's own mean and sum, or the
  // absence, in the same `TangleRow` shape `contribute` bands a drawn file by.
  const measured = b.fileTanLoc[p]
  const tangleRow: TangleRow = measured > 0
    ? [lines, b.fileTan0[p] / measured, b.fileTan1[p] / measured, b.fileCog[p]]
    : [lines, -1, -1, -1]
  t.tangle.push(...tangleRow)
  const lang = hist.langs[p]
  if (lang) t.lang.set(lang, (t.lang.get(lang) ?? 0) + lines)
  const who = authorName(hist, frame.author[p])
  // A file git has never seen is left out rather than folded into a name — the same thing
  // the live walk does with a missing author, one surface over.
  if (who) t.author.set(who, (t.author.get(who) ?? 0) + lines)
  // Counted at read time rather than carried, the same way a function's is: the window
  // moves with the playhead, so a touch that counted last frame may have aged out of this
  // one. See `Frame.pathHits`.
  const ts = frame.pathTs[p]
  const commits: ChurnWindows = [0, 0, 0, 0]
  if (ts !== NO_TS) {
    const base = p * CHURN_MEMORY
    const len = frame.pathHitLen[p]
    for (let i = 0; i < len; i++) {
      const age = daysBetween(frame.ts, frame.pathHits[base + i])
      for (let w = 0; w < 4; w++) if (age <= windows[w]) commits[w]++
    }
  }
  const born = frame.pathBorn[p]
  // **Typed as `TimeRow` rather than pushed loose, and that is the whole guard.** The reader
  // is in another file and steps by `TIME_STRIDE`; a row that is one number short does not
  // throw, it reads the next file's touch date as this one's line count and bands the frame
  // out of numbers that are all real and all in the wrong slots. Both ends are pinned to
  // this tuple, so the stride cannot move at one end only.
  const row: TimeRow = [
    ts === NO_TS ? -1 : daysBetween(frame.ts, ts),
    // `-1` is a file this story never saw ARRIVE, which is every file in the opening state:
    // undated, the same absence `pathTs` reports, and never dated to frame one. Age's second
    // reading needs it — see `AgeView`.
    born === NO_TS ? -1 : daysBetween(frame.ts, born),
    lines,
    ...commits,
  ]
  t.time.push(...row)
}

/** Every live file under `d`, for a directory that is being folded whole. */
function foldDir(b: Build, t: Tally, d: number): void {
  for (const p of b.shape.files[d]) {
    const lines = b.fileLoc[p]
    if (lines > 0) tallyFile(b, t, p, lines, b.fileKind)
  }
  for (const k of b.shape.kids[d]) foldDir(b, t, k)
}

/** A finished tally, in the shape `Node.folded` carries. */
function settle(t: Tally): Folded {
  return {
    lang: [...t.lang.entries()],
    author: [...t.author.entries()],
    kind: [...t.kind.entries()],
    time: t.time,
    tangle: t.tangle,
  }
}

/** What one directory's walk has rolled up so far, for its crowd stand-in: the lines and
 *  files too thin to draw, whether any of them flashed, and the tally of what they were. */
interface Rest {
  lines: number
  files: number
  birth: boolean
  edit: boolean
  tally: Tally
}

/** Descend while there is something worth drawing, and roll up what there is not. */
export function descend(b: Build, d: number, into: Node): void {
  const { shape, scope, inScope, forced } = b
  const rest: Rest = { lines: 0, files: 0, birth: false, edit: false, tally: tallyOf() }
  const cut =
    inScope && (forced.has(d) || shape.path[d].startsWith(`${scope}/`)) ? b.scopeMin : b.minLoc
  for (const k of shape.kids[d]) {
    const lines = b.dirLoc[k]
    if (lines <= 0) continue
    if (lines >= cut || forced.has(k)) {
      const node = dirNodeFor(b, k)
      into.children.push(node)
      descend(b, k, node)
      continue
    }
    restDir(b, rest, k, lines)
  }
  for (const p of shape.files[d]) {
    const lines = b.fileLoc[p]
    if (lines <= 0) continue
    if (lines >= cut) {
      into.children.push(fileNodeFor(b, p))
      continue
    }
    restFile(b, rest, p, lines)
  }
  if (rest.lines > 0) {
    into.children.push(
      crowd(b, d, rest.lines, rest.files, rest.birth, rest.edit, settle(rest.tally)),
    )
  }
}

/** A directory too thin to draw, folded whole into its parent's crowd. */
function restDir(b: Build, rest: Rest, k: number, lines: number): void {
  rest.lines += lines
  rest.files += b.dirFiles[k]
  foldDir(b, rest.tally, k)
  rest.birth = rest.birth || b.dirBirth[k] === 1
  rest.edit = rest.edit || b.dirEdit[k] === 1
}

/** A file too thin to draw, folded into its directory's crowd. */
function restFile(b: Build, rest: Rest, p: number, lines: number): void {
  const { frame, since } = b
  rest.lines += lines
  rest.files += 1
  tallyFile(b, rest.tally, p, lines, b.fileKind)
  const born = frame.pathBornAt[p]
  rest.birth =
    rest.birth || b.restBirth[p] === 1 || (born !== NO_AT && inStep(born, since, frame.at))
  rest.edit = rest.edit || b.restEdit[p] === 1
}

/** Whether a container arrived on this step, by node id — what `aggregate` asks of each. */
export function arrivalOf(b: Build): (id: string) => number | null {
  const { frame, since, shape } = b
  const pathIndex = pathIndexOf(b.hist)
  return (id) => {
    // A dir first, then a file: the two namespaces are disjoint — a node id IS its path —
    // and asking the shape rather than the frame is what lets both be dense.
    const d = shape.dirAt.get(id)
    let at = d !== undefined ? frame.dirBornAt[d] : NO_AT
    if (at === NO_AT) {
      const p = pathIndex.get(id)
      if (p !== undefined) at = frame.pathBornAt[p]
    }
    return at !== NO_AT && inStep(at, since, frame.at) ? 1 : null
  }
}
