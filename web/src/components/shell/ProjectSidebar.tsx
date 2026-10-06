import type { MapView } from '../../hooks/useMap'
import type { Overlays } from '../../hooks/useOverlays'
import type { Project } from '../../hooks/useProject'
import { SideBar } from '../SideBar'

/** The project list down the left, wired to the doors it opens: the Read dialog, adding a repo,
 *  and the trace and replay a row's pill runs. */
export function ProjectSidebar({
  project,
  setReadFor,
  map,
}: {
  project: Pick<Project, 'projects' | 'activeKey' | 'addProject' | 'forget' | 'reset' | 'setError' | 'scanKey' | 'select'>
  setReadFor: Overlays['setReadFor']
  map: Pick<MapView, 'hist' | 'trace' | 'chaseTrace' | 'stopChain'>
}) {
  return (
    <SideBar
      projects={project.projects}
      active={project.activeKey}
      // The replay reports itself on its own project's row. It used to be a strip across
      // the top of the map, which is a surface belonging to whatever project is on
      // screen — so switching away left ceph's 122,818 commits counting over sanity.
      replayKey={map.hist.busyKey}
      replay={map.hist.historyProgress}
      // The picker reports its own refusals — a directory holding twelve repos is a
      // sentence worth reading, not a silent no-op. A dismissed dialog resolves null
      // and says nothing, because canceling is not an error.
      onRead={(key) => setReadFor(key)}
      onAdd={project.addProject}
      onForget={project.forget}
      onReset={project.reset}
      onError={project.setError}
      // **Both pill actions are the same press.** `phasesOf` reports `replay` for the
      // column's last third and `trace` for the first two, which is right for naming what
      // a step DOES — and from the row's side all three are one word being pressed, so
      // they land on one handler that works out where the column has got to.
      onReplay={(key, fresh) => (fresh ? map.trace(key, true) : map.chaseTrace(key))}
      onTrace={map.chaseTrace}
      onScan={project.scanKey}
      onStopTrace={map.stopChain}
      onSelect={project.select}
    />
  )
}
