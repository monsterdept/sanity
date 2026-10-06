import type { Navigation } from '../../hooks/useNavigation'
import type { Overlays } from '../../hooks/useOverlays'
import type { Paint } from '../../hooks/usePaint'
import type { Project } from '../../hooks/useProject'
import type { Standing } from '../../hooks/useMap'
import { CodeOverlay } from '../CodeOverlay'
import { ReadDialog } from '../ReadDialog'
import { BigFolderDialog, BigHistoryDialog, CliLinkDialog } from './Dialogs'

/** What floats over the whole window rather than over the map: the dialogs that ask before
 *  something costly or one-off happens, and the code of an open file. */
export function WindowOverlays({
  overlays,
  project,
  setPicked,
  paint,
  nav,
}: {
  overlays: Overlays
  project: Pick<Project, 'projects' | 'takeFolder' | 'refreshProjects' | 'repoPath'>
  setPicked: Standing['setPicked']
  paint: Pick<Paint, 'viewMode' | 'authorRank' | 'langRank' | 'lensViews'>
  nav: Pick<Navigation, 'codeNode' | 'selected'>
}) {
  const { bigFolder, bigHistory, cliLink, readFor } = overlays
  return (
    <>
      {bigFolder && (
        <BigFolderDialog
          bigFolder={bigFolder}
          setBigFolder={overlays.setBigFolder}
          takeFolder={project.takeFolder}
        />
      )}

      {bigHistory && (
        <BigHistoryDialog
          bigHistory={bigHistory}
          setBigHistory={overlays.setBigHistory}
          hideExplain={overlays.hideExplain}
          setHideExplain={overlays.setHideExplain}
          takeFolder={project.takeFolder}
        />
      )}

      {cliLink && <CliLinkDialog cliLink={cliLink} setCliLink={overlays.setCliLink} />}

      {/* Keyed off the live list rather than a captured object: the poll replaces these
          every tick, and a dialog holding the row it was opened with would show counts
          frozen at the moment it opened. */}
      {readFor &&
        (() => {
          const p = project.projects.find((x) => x.key === readFor)
          return p ? (
            <ReadDialog
              project={p}
              onStarted={project.refreshProjects}
              onClose={() => overlays.setReadFor(null)}
            />
          ) : null
        })()}

      {nav.codeNode && (
        <CodeOverlay
          codeNode={nav.codeNode}
          repoPath={project.repoPath}
          selected={nav.selected}
          reveal={overlays.reveal}
          viewMode={paint.viewMode}
          authorRank={paint.authorRank}
          langRank={paint.langRank}
          lensViews={paint.lensViews}
          setPicked={setPicked}
          setCodeFile={overlays.setCodeFile}
        />
      )}
    </>
  )
}
