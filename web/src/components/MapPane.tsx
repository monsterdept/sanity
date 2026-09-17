import type { ComponentProps } from 'react'
import { countPending, scanRepo, type Node, type Progress, type ProjectSummary } from '../lib/api'
import { holdsUncommitted, legendFor, type BlameRead, type ColorMode, type Views } from '../lib/colorMode'
import { ColorLegend } from './ColorKey'
import { Empty, Unscanned } from './EmptyPane'
import { ProgressPane, ProgressStrip } from './Progress'
import { Sunburst } from './Sunburst'

/** Handlers the assembling map has no use for: it is a picture of a scan in progress, and
 *  there is nothing under a wedge to select, drill into or clear yet. */
const noop = () => {}

type SunburstProps = ComponentProps<typeof Sunburst>

/** The picture, and every answer the pane gives when there is no picture to give.
 *
 *  **The branches are an order, and the order is the behaviour**: an error outranks an empty
 *  history, which outranks the map, which outranks the map assembling, then a project nothing
 *  is happening to, then the wait, then the launch not having asked yet, and only then the
 *  first-run card. The key and the scan's strip float over whichever of those is drawn. */
export function MapPane({
  error,
  setError,
  historyEmpty,
  focus,
  faceRev,
  selected,
  viewMode,
  ranks,
  lensViews,
  replaying,
  readingNow,
  findingsForMap,
  setPaneSide,
  rings,
  band,
  spacing,
  markers,
  wantRings,
  headOrder,
  pick,
  clearPick,
  drill,
  goUp,
  awaiting,
  shapeRoot,
  shapeSort,
  live,
  awaitingProgress,
  projectsLoaded,
  addProject,
  blameRead,
}: {
  error: string | null
  setError: (e: string) => void
  historyEmpty: boolean
  focus: Node | null
  faceRev: number
  selected: Node | null
  viewMode: ColorMode
  ranks: Map<string, number> | undefined
  lensViews: Views
  replaying: boolean
  readingNow: Set<string>
  findingsForMap: SunburstProps['findings']
  setPaneSide: (side: number) => void
  rings: number
  band: number
  spacing: SunburstProps['spacing']
  markers: boolean
  wantRings: (paths: readonly string[]) => void
  headOrder: SunburstProps['sortBy']
  pick: (n: Node) => void
  clearPick: () => void
  drill: (n: Node) => void
  goUp: (() => void) | undefined
  awaiting: ProjectSummary | null
  shapeRoot: Node | null
  shapeSort: Map<string, number>
  live: Set<string>
  awaitingProgress: Progress | null
  projectsLoaded: boolean
  addProject: () => void
  blameRead: BlameRead
}) {
  return (
    /* `data-chart` is how the key finds the circle it has to wrap around — see
        `useMapEdge`. A marker rather than a class name because the class list here is
        layout that will change, and the key would break silently when it did. */
    <div data-chart className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <div className="relative z-10 h-full bg-[var(--background)]">
        {error ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="max-w-[40ch] text-center text-sm text-[var(--destructive)]">
              {error}
            </p>
          </div>
        ) : historyEmpty ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="max-w-[40ch] text-center text-sm text-[var(--muted-foreground)]">
              No git history here, so there is nothing to replay. The map beside this is
              still the repo as it stands.
            </p>
          </div>
        ) : focus ? (
          // A file is no longer a different view. It used to be `FileStack`, a vertical
          // column reached by a hard cut — the argument being that a file is a sequence
          // and the ring is a set, which is true and was never the whole of it: the
          // wedge ALREADY holds a treemap of the file, so what the column really did
          // was throw away the picture you had just clicked and draw a second one. The
          // rings now unroll that same tiling into the pane instead. See `unroll.ts`.
          <Sunburst
            root={focus}
            faceRev={faceRev}
            selected={selected}
            mode={viewMode}
            ranks={ranks}
            // The age ramp spans the REPO, not a fixed year — so it comes from the
            // whole tree even when the view is drilled into one directory. Scoping it
            // to `focus` would make a wedge change color on the way in, which is the
            // one thing drilling must not do.
            views={lensViews}
            // **Never into a replay.** A lease says a reader is opening THIS function right now, and
            // the marker is keyed by path — `path` for the file, `path#name` for the
            // function — so on a frame from 2019 it lights whatever happens to sit at
            // that path in 2019, which is frequently a different function and sometimes
            // one that has nothing to do with the work. That is a measurement stamped
            // onto code nobody measured, the same sin as a stale reading keeping its
            // colour, and it reached a person as black wedges flashing through an
            // exported movie of a repo's first year.
            //
            // Keyed on `replaying` rather than `historyOn` for the reason the lens and
            // the legend are: the request comes a few hundred milliseconds before the
            // first frame, and until that frame exists the live map is still on screen,
            // where the marks are about exactly the wedges they are sitting on.
            reading={replaying ? undefined : readingNow}
            findings={findingsForMap}
            // Only the replay. A commit landing is a change the viewer asked to watch,
            // so it should move; a rescan or a landed reading changes the live map under
            // somebody who is reading it, and sliding the wedges there would animate a
            // measurement arriving rather than a story advancing.
            morph={replaying}
            replaying={replaying}
            onSide={setPaneSide}
            rings={rings}
            rimShare={band}
            spacing={spacing}
            // Only here. The scan-time map below has no readings and no clone columns,
            // so it has no marks to suppress, and a prop that can never matter is a
            // second place to keep in step for nothing.
            markers={markers}
            onWantRings={wantRings}
            sortBy={headOrder}
            onSelect={pick}
            onClear={clearPick}
            onDrill={drill}
            onUp={goUp}
          />
        ) : awaiting && shapeRoot ? (
          // The scan is still running and the map is already worth looking at. See
          // `lib/shape.ts` — this is the same picture, drawn from what the parse has
          // found so far, with no reading on any wedge.
          <Sunburst
            root={shapeRoot}
            selected={null}
            mode={viewMode}
            sortBy={shapeSort}
            // Eased, not snapped. The rings are gaining wedges several times a second
            // and a repo that jumps on every batch reads as a glitch; the same
            // argument the replay makes, for the same reason — see `morph`.
            morph
            // The same ring count the finished map will use, or the picture reorganises
            // itself the moment the scan lands — a map that changes depth on its own is
            // the reader's setting appearing to be ignored and then obeyed.
            rings={rings}
            // On the scan-time map too, and for the ring count's own reason: the
            // picture must not respace itself the moment the scan lands.
            spacing={spacing}
            // Where the scan has got to — see `live`. The same prop a run uses for its
            // leases, because it is the same claim about a wedge, and the two phases
            // never overlap.
            reading={live}
            onSelect={noop}
            onClear={noop}
            onDrill={noop}
          />
        ) : awaiting && !awaiting.loading && (awaiting.unloaded || awaiting.scan_cost) ? (
          // **Nothing is happening here, and the pane used to say it was.** This is a
          // project the app knows and is not holding — reset, declined for cost, or a
          // volume that was not mounted when the restore reached it — so there is no
          // scan to wait for and no progress to report. It fell through to the wait
          // below and read `Reading tattle…` under a bar that never moved, for as long
          // as anybody left it selected. The row beside it says the same thing in three
          // words; this is the room to say it properly and to offer the work.
          <Unscanned
            project={awaiting}
            onScan={() => {
              void scanRepo(awaiting.repo).catch((err) => setError(String(err)))
            }}
          />
        ) : awaiting ? (
          // There are projects, and none of them has a tree on screen yet. The empty
          // pane's copy tells you how to open a project — advice for someone with none,
          // addressed to someone who has three and is waiting on one. Show the wait.
          <ProgressPane label={`Reading ${awaiting.name}…`} progress={awaitingProgress} />
        ) : !projectsLoaded ? (
          // Not "no projects" — "not asked yet". Blank on purpose: the splash is still
          // over this, and anything written here is a screen nobody asked for between
          // the wordmark and the answer.
          <div className="h-full" />
        ) : (
          <Empty onAdd={addProject} />
        )}
      </div>

      {/* The scan, over the map it is drawing, in the legend's corner.
        It sat top centre, on the argument that a caption belongs over its picture —
        which put it on the one edge the eye is drawn to and made a temporary thing
        the most prominent element on screen. The corners are where this window
        already keeps what it says ABOUT the map: the caveat chip bottom-left, the
        legend bottom-right. A scan's progress is that kind of note, and it takes the
        legend's place because the two can never appear together — the legend needs
        `focus`, which is exactly what the assembling map does not have.
        Shown with the assembling map only. `!focus` is the same test the branch above
        makes, held here too because this element is a sibling of the branch rather
        than inside it: a strip over a FINISHED map would be describing a scan of some
        other repo, which is precisely the confusion the shape's ownership fixed. */}
      {awaitingProgress && shapeRoot && !focus && (
        <div className="absolute bottom-2 right-2 z-20">
          <ProgressStrip progress={awaitingProgress} />
        </div>
      )}

      {/* Floated over the graph rather than stacked under it. The rings are a
        circle in a rectangle, so the corners and the top strip are dead space
        the picture never uses — putting the controls there costs the chart
        nothing and buys back a whole row of window height. */}
      {focus && focus.kind !== 'file' && (
        <div className="absolute bottom-2 right-2 z-20">
          <ColorLegend
            mode={viewMode}
            // The key names the ramp's ends and Age has two sets of them — see
            // `rampEnds`. A key reading `old → recent` over a map painted by birth
            // date is the legend disagreeing with the picture, which is the one
            // thing a key must never do.
            views={lensViews}
            // From `focus`, like the ranks it has to agree with — a legend naming
            // eight authors the rings in front of you do not contain is annotating a
            // picture nobody is looking at. The comment below said this before the
            // code did: it was true of the counts and not of the categories, which
            // came from the whole scan.
            categories={focus ? legendFor(focus, viewMode, blameRead) : []}
            uncommitted={
              viewMode === 'blame' && focus !== null && holdsUncommitted(focus, blameRead)
            }
            // The same map the wedges take their slots from, or the key and the
            // picture disagree the moment the two orders diverge — which a held
            // rank order during a replay guarantees they will.
            ranks={ranks}
            // Not read, only keyed on: a drill moves and resizes the disc the key is
            // cut around, so the shape has to be measured again. See `useMapEdge`.
            at={focus?.id}
            // Counted from `focus`, not the whole scan: drilled into one
            // directory, the legend has to describe the rings in front of you or
            // it is annotating a picture nobody is looking at.
            {...countPending(focus)}
          />
        </div>
      )}
    </div>
  )
}
