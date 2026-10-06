import { LensRow } from './components/shell/LensRow'
import { MapColumn } from './components/shell/MapColumn'
import { ProjectSidebar } from './components/shell/ProjectSidebar'
import { SidePanel } from './components/shell/SidePanel'
import { WindowOverlays } from './components/shell/WindowOverlays'
import { useLensChoices } from './hooks/useLens'
import { useMap, useStanding } from './hooks/useMap'
import { useNavigation } from './hooks/useNavigation'
import { useOverlays } from './hooks/useOverlays'
import { usePaint } from './hooks/usePaint'
import { useProject } from './hooks/useProject'
import { useWindow } from './hooks/useWindowChrome'

/** The window: a pipeline of what it knows, each layer handed the ones before it, and the layout.
 *
 *  First the state nothing feeds — which overlay is up, which lens was chosen, where you are
 *  standing — then the project (which repo, and what is known about it), the map (which tree is
 *  on screen and where it is rooted), the paint (how that tree is coloured), the gestures that
 *  move around it, and last the window's own concerns, which only listen.
 *
 *  **Hooks run their effects in the order they are called, and two orderings here are
 *  load-bearing:** the ring graft's clear runs before the ring fetch and before navigation's
 *  jump, which both add to what it clears — see `useRingGraft` in `useMap`; and the splash and
 *  the stopwatch go last, after everything they report on. Every other effect is a listener or
 *  a fetch that answers later, and does not care what ran before it. */
export default function App() {
  const overlays = useOverlays()
  const choices = useLensChoices()
  const standing = useStanding()
  const project = useProject(choices, standing, overlays)
  const map = useMap(standing, overlays, project)
  const paint = usePaint(choices, standing, overlays, project, map)
  const nav = useNavigation(standing, overlays, project.activeKey, map)
  const { faceRev } = useWindow(overlays.setCliLink, project, map)

  return (
    <div className="relative flex h-full flex-col">
      {/* The chrome is ONE painted field: the gradient lives here, on the row, and the
          sidebar and the top strip are transparent windows onto it. Painted per element
          they were two gradients that happened to start at the same y — matching until
          anything moved, and separated by a border that ran the full height including
          straight through the titlebar. The content panes sit on top with their own
          surface, so the only edges left are the ones between chrome and content. */}
      <div className="shell-chrome chrome-surface flex min-h-0 flex-1">
        <ProjectSidebar project={project} setReadFor={overlays.setReadFor} map={map} />
        <div className="flex min-w-0 flex-1 flex-col">
          <LensRow
            choices={choices}
            overlays={overlays}
            historyOn={standing.historyOn}
            activeProject={project.activeProject}
            map={map}
            paint={paint}
          />
          <MapColumn
            overlays={overlays}
            choices={choices}
            historyOn={standing.historyOn}
            project={project}
            map={map}
            paint={paint}
            nav={nav}
            faceRev={faceRev}
          />
        </div>

        <SidePanel project={project} standing={standing} map={map} paint={paint} nav={nav} />
      </div>

      <WindowOverlays
        overlays={overlays}
        project={project}
        setPicked={standing.setPicked}
        paint={paint}
        nav={nav}
      />
    </div>
  )
}
