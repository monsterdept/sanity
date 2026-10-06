import type { LensChoices } from '../../hooks/useLens'
import type { MapView, Standing } from '../../hooks/useMap'
import type { Overlays } from '../../hooks/useOverlays'
import type { Paint } from '../../hooks/usePaint'
import type { ProjectSummary } from '../../lib/api'
import { TopRow } from './TopRow'
import { LensBar } from './LensBar'

/** The content column's top strip, holding the lens switcher once there is a map to switch. */
export function LensRow({
  choices,
  overlays,
  historyOn,
  activeProject,
  map,
  paint,
}: {
  choices: LensChoices
  overlays: Pick<Overlays, 'helping' | 'setHelping' | 'finding' | 'setFinding' | 'findingsOpen'>
  historyOn: Standing['historyOn']
  activeProject: ProjectSummary | null
  map: Pick<MapView, 'focus' | 'hist' | 'toggleHistory'>
  paint: Pick<Paint, 'viewMode' | 'locks' | 'lensViews'>
}) {
  return (
    <TopRow>
      {map.focus && (
        <LensBar
          helping={overlays.helping}
          setHelping={overlays.setHelping}
          viewMode={paint.viewMode}
          setMode={choices.setMode}
          locks={paint.locks}
          caps={choices.caps}
          chooseCap={choices.chooseCap}
          markers={choices.markers}
          setMarkers={choices.setMarkers}
          ageRead={choices.ageRead}
          setAgeRead={choices.setAgeRead}
          tangleRead={choices.tangleRead}
          setTangleRead={choices.setTangleRead}
          blameRead={choices.blameRead}
          setBlameRead={choices.setBlameRead}
          derivable={choices.derivable}
          setDerivable={choices.setDerivable}
          lensViews={paint.lensViews}
          setChurnAt={choices.setChurnAt}
          rings={choices.rings}
          chooseRings={choices.chooseRings}
          historyOn={historyOn}
          historyBusy={map.hist.historyBusy}
          activeProject={activeProject}
          toggleHistory={map.toggleHistory}
          finding={overlays.finding}
          findingsOpen={overlays.findingsOpen}
          setFinding={overlays.setFinding}
        />
      )}
    </TopRow>
  )
}
