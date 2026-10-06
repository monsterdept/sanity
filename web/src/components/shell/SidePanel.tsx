import type { MapView, Standing } from '../../hooks/useMap'
import type { Navigation } from '../../hooks/useNavigation'
import type { Paint } from '../../hooks/usePaint'
import type { Project } from '../../hooks/useProject'
import { CommitLog } from '../CommitLog'
import { Detail } from '../Detail'

/** The right-hand panel: what you are looking at, or — while a replay is up — the commit log. */
export function SidePanel({
  project,
  standing,
  map,
  paint,
  nav,
}: {
  project: Pick<Project, 'scan' | 'activeKey' | 'activeProject' | 'repoPath'>
  standing: Pick<Standing, 'historyOn' | 'setPicked'>
  map: Pick<MapView, 'tree' | 'focus' | 'hist' | 'scope' | 'frames'>
  paint: Pick<Paint, 'viewMode' | 'ranks' | 'lensViews'>
  nav: Pick<Navigation, 'selected' | 'drill' | 'owners' | 'showIn' | 'jumpTo'>
}) {
  const { scan, activeKey, activeProject, repoPath } = project
  const { tree, focus, hist } = map
  const { history } = hist
  return (
    <aside className="w-[290px] shrink-0 border-l border-[var(--border)] bg-[var(--card)]">
      {/* The log takes the panel while the replay is up. Not beside it: the panel
          answers "what am I looking at", and during a replay that answer is the
          commit, not whichever wedge the pointer last brushed. */}
      {standing.historyOn && history && hist.historyKey === activeKey ? (
        <CommitLog
          repoKey={activeKey}
          repoPath={repoPath}
          tables={history.tables}
          frames={map.frames}
          scope={map.scope}
          index={hist.histIndex}
          playing={hist.playing}
          onIndex={hist.scrubTo}
          name={map.scope || (activeProject?.name ?? 'History')}
          repo={repoPath}
          loc={focus?.loc ?? 0}
          functions={activeProject?.functions ?? 0}
        />
      ) : (
        <Detail
          node={nav.selected}
          // What the summary covers when nothing is picked: the subtree on screen, not
          // the repo, so drilling in re-counts rather than repeating a number the
          // sidebar already shows for the whole project.
          focus={focus}
          title={
            focus && tree && focus.id === tree.id
              ? (activeProject?.name ?? focus.name)
              : focus?.name
          }
          repo={repoPath}
          model={scan?.stats.model ?? null}
          mode={paint.viewMode}
          ranks={paint.ranks}
          views={paint.lensViews}
          tangleBands={scan?.stats.tangleBands}
          tangleOver={scan?.stats.tangleOver}
          onSelect={standing.setPicked}
          onDrill={nav.drill}
          owners={nav.owners}
          onShowIn={nav.showIn}
          repoKey={activeKey}
          replaying={hist.replaying}
          onJump={nav.jumpTo}
        />
      )}
    </aside>
  )
}
