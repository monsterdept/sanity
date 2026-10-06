import { lazy, Suspense } from 'react'
import type { LensChoices } from '../../hooks/useLens'
import type { MapView } from '../../hooks/useMap'
import type { Navigation } from '../../hooks/useNavigation'
import type { Overlays } from '../../hooks/useOverlays'
import type { Paint } from '../../hooks/usePaint'
import type { Project } from '../../hooks/useProject'
import { ageSpanOf } from '../../lib/colorMode'
import { CIRCLES } from '../../lib/hub'
import { Find } from '../Find'
import { Findings } from '../Findings'
import { LensHelp } from '../LensHelp'

/** The report dialog, loaded when it is opened. **It carries the PDF renderer** — HarfBuzz and its
 *  wasm, React's static renderer, the map's markup path — none of which the window needs to open, and
 *  a failure in any of it must never hold the window on its splash screen, which it once did. */
const ReportDialog = lazy(() =>
  import('../ReportDialog').then((m) => ({ default: m.ReportDialog })),
)

/** What is summoned over the map rather than living beside it: the finder, the findings, the lens
 *  help and the report. Each lands over the picture it is about. */
export function MapOverlays({
  overlays,
  choices,
  historyOn,
  project,
  map,
  paint,
  flyTo,
}: {
  overlays: Pick<
    Overlays,
    'finding' | 'setFinding' | 'findingsOpen' | 'setFindingsOpen' | 'findingsAsk' | 'helping' | 'setHelping' | 'reporting' | 'setReporting'
  >
  choices: Pick<LensChoices, 'mode' | 'rings' | 'spacing' | 'band' | 'markers'>
  historyOn: boolean
  project: Pick<Project, 'scan' | 'activeKey' | 'activeProject' | 'repoPath' | 'findings' | 'remote'>
  map: Pick<MapView, 'filled' | 'tree' | 'hist'>
  paint: Pick<Paint, 'locks' | 'lensViews' | 'reportLangs' | 'slotsFor' | 'completeTree'>
  flyTo: Navigation['flyTo']
}) {
  const { scan, activeKey, activeProject, repoPath, findings, remote } = project
  const { filled, tree, hist } = map
  return (
    <>
      {/* Over the map rather than in the bar. A search box parked in the chrome is a
          control you have to look at forever to use twice a day; summoned by ⌘F it
          costs nothing when it is not wanted, and it lands over the picture it is
          about to move. */}
      <Find
        open={overlays.finding}
        projectKey={activeKey}
        replaying={historyOn}
        onClose={() => overlays.setFinding(false)}
        onPick={flyTo}
      />

      {/* Beside the finder because it lands the same way — a row flies the camera
          through `flyTo`, which is the motion drilling in by hand already makes. What
          differs is who chose the destination: the finder is somebody naming a thing,
          and this is the map naming one. */}
      <Findings
        open={overlays.findingsOpen}
        ask={overlays.findingsAsk}
        projectKey={activeKey}
        groups={findings.findingGroups}
        replaying={historyOn}
        archive={findings.archive}
        rules={findings.rules}
        grammar={findings.grammar}
        onSaveRule={findings.writeRule}
        onDeleteRule={findings.removeRule}
        onResetRule={findings.restoreRule}
        onApplyBalance={findings.saveBalance}
        onStock={findings.toStock}
        onDecide={findings.decide}
        onUndecide={findings.undecide}
        onClose={() => overlays.setFindingsOpen(false)}
        onPick={flyTo}
      />

      {/* Mounted only while it is up, unlike `Find`, which holds an index it does not
          want to rebuild. This one is static text and its cost is its own markup. */}
      {overlays.helping && <LensHelp onClose={() => overlays.setHelping(false)} />}
      {overlays.reporting && (
        <Suspense fallback={null}>
          <ReportDialog
            slug={remote ?? activeProject?.name ?? 'repo'}
            name={activeProject?.name ?? 'sanity'}
            repo={repoPath ?? null}
            views={paint.lensViews}
            ready={tree !== null && activeProject !== null}
            replaying={historyOn}
            groups={findings.findingGroups}
            locks={paint.locks}
            mode={choices.mode}
            stats={{
              lines: filled?.loc ?? 0,
              functions: activeProject?.functions ?? 0,
              files: activeProject?.files ?? 0,
              assessed: activeProject?.assessed ?? 0,
              stale: activeProject?.stale ?? 0,
              unparsed: filled?.unparsed ?? null,
              languages: paint.reportLangs,
              model: activeProject?.banked_model ?? null,
              harness: activeProject?.banked_harness ?? null,
              models: activeProject?.banked_models ?? [],
              tangleBands: scan?.stats.tangleBands ?? [],
              callsResolved: scan?.stats.callsResolved ?? null,
              callsUnresolved: scan?.stats.callsUnresolved ?? null,
              commits: scan?.stats.commits ?? 0,
              authors: scan?.stats.authors.length ?? 0,
              churnWindows: [...hist.churnWindows],
              ageSpan: filled ? ageSpanOf(filled) : null,
            }}
            slotsFor={paint.slotsFor}
            look={{
              rings: choices.rings,
              spacing: choices.spacing,
              rimShare: choices.band,
              markers: choices.markers,
              circles: CIRCLES,
            }}
            sortBy={hist.headOrder}
            complete={paint.completeTree}
            onClose={() => overlays.setReporting(false)}
          />
        </Suspense>
      )}
    </>
  )
}
