import type { LensChoices } from '../../hooks/useLens'
import type { MapView } from '../../hooks/useMap'
import type { Navigation } from '../../hooks/useNavigation'
import type { Overlays } from '../../hooks/useOverlays'
import type { Paint } from '../../hooks/usePaint'
import type { Project } from '../../hooks/useProject'
import { Crumbs } from '../Crumbs'
import { HistoryBar } from '../HistoryBar'
import { MapPane } from '../MapPane'
import { MapOverlays } from './MapOverlays'

/** The content column under the lens strip: the trail, what is summoned over the map, the map,
 *  and the replay's transport beneath it while one is on screen. */
export function MapColumn({
  overlays,
  choices,
  historyOn,
  project,
  map,
  paint,
  nav,
  faceRev,
}: {
  overlays: Overlays
  choices: LensChoices
  historyOn: boolean
  project: Project
  map: MapView
  paint: Paint
  nav: Navigation
  /** Ticks when the webfont lands — see `useFaceRev`. */
  faceRev: number
}) {
  const { activeKey, activeProject } = project
  const { tree, focus, hist } = map
  const { history } = hist
  const { viewMode } = paint
  return (
    <main className="relative flex min-w-0 flex-1 flex-col border-l border-t border-[var(--border)] bg-[var(--background)]">
      {/* Inside the content column, not spanning the window above the chrome.
        Up there it took row 0 for itself — and row 0 belongs to the overlay
        titlebar, whose traffic lights float over the webview at a fixed inset that
        each element occupying that row has to reserve for itself. The strip
        reserved nothing and pushed the sidebar header, which does, out from under
        them, so "Reading the repo…" rendered beneath the buttons. It also shoved
        the whole shell down by its own height every time a scan started. Below
        TopRow it can do neither. */}
      {tree && focus && <Crumbs trail={nav.trail} onGo={nav.goTo} onUp={nav.goUp} />}

      <MapOverlays
        overlays={overlays}
        choices={choices}
        historyOn={historyOn}
        project={project}
        map={map}
        paint={paint}
        flyTo={nav.flyTo}
      />

      <MapPane
        error={project.error}
        setError={project.setError}
        historyEmpty={hist.historyEmpty}
        focus={focus}
        faceRev={faceRev}
        selected={nav.selected}
        viewMode={viewMode}
        ranks={paint.ranks}
        lensViews={paint.lensViews}
        replaying={hist.replaying}
        readingNow={project.readingNow}
        findingsForMap={project.findings.findingsForMap}
        setPaneSide={paint.setPaneSide}
        rings={choices.rings}
        band={choices.band}
        spacing={choices.spacing}
        markers={choices.markers}
        wantRings={map.wantRings}
        headOrder={hist.headOrder}
        pick={nav.pick}
        clearPick={nav.clearPick}
        drill={nav.drill}
        goUp={nav.goUp}
        awaiting={project.awaiting}
        shapeRoot={project.shapeRoot}
        shapeSort={project.shapeSort}
        live={project.live}
        awaitingProgress={project.awaitingProgress}
        projectsLoaded={project.projectsLoaded}
        addProject={project.addProject}
        blameRead={choices.blameRead}
      />

      {/* Under the map, not floated over it. The legend is an annotation and can live
        in a corner; the transport is the control the whole view is about, and the
        scrub bar needs the full width or it cannot address the commits it draws. */}
      {historyOn && history && hist.historyKey === activeKey && history.tables.commits > 0 && (
        <HistoryBar
          frames={map.frames}
          index={hist.histIndex}
          onIndex={hist.indexTo}
          playing={hist.playing}
          onPlaying={hist.setPlaying}
          flashes={hist.flashes}
          onFlashes={hist.setFlashes}
          duration={hist.duration}
          onDuration={hist.setDuration}
          name={map.scope || (activeProject?.name ?? 'history')}
          // What an exported movie is captioned with: the repo, as the world knows it,
          // and where in it the replay is standing. Both go to the caption; `name`
          // above is the FILENAME, which wants the drilled path and not the owner.
          slug={project.remote ?? activeProject?.name ?? 'repo'}
          scope={map.scope}
          movie={paint.movieSource}
          mode={viewMode}
          ensure={hist.ensureTo}
          dateOf={hist.dateOf}
        />
      )}
    </main>
  )
}
