import { useCallback, useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  estimateTrace,
  explainTrace,
  onOpenProject,
  pickProject,
  scanRepo,
  type Added,
  type TraceCost,
} from '../lib/api'

/** Adding a repo by hand: the picker, the two questions a big folder or a big history is asked
 *  before anything is spent on it, and ⌘O. The new repo is followed to the map by
 *  `useProjects`, which is handed its key through `setPendingAdd`. */
export function useAddProject({
  setError,
  setPendingAdd,
  setBigFolder,
  setBigHistory,
}: {
  setError: Dispatch<SetStateAction<string | null>>
  setPendingAdd: Dispatch<SetStateAction<string | null>>
  /** The two dialogs' own state is `useOverlays`'s; this only raises them. */
  setBigFolder: Dispatch<SetStateAction<Added | null>>
  setBigHistory: Dispatch<SetStateAction<{ added: Added; cost: TraceCost } | null>>
}) {

  // One add path for the sidebar's `+` and the empty gate's button.
  //
  // Two copies would be two chances for them to disagree about what happens when the
  // picker is dismissed or the directory is refused — and the gate is exactly where a
  // first-time user meets the refusal.
  /** Start scanning one folder. The tail of both paths in. */
  const takeFolder = useCallback((path: string, key: string) => {
    setBigFolder(null)
    setPendingAdd(key)
    void scanRepo(path).catch((e) => {
      setPendingAdd(null)
      setError(String(e))
    })
  }, [])

  const addProject = useCallback(() => {
    setError(null)
    void pickProject()
      .then((added) => {
        if (!added) return
        // **A directory of repos is asked about, not refused.** Requiring a `.git` made this
        // impossible to do by accident and impossible to do on purpose; what it was really
        // guarding is the CPU — `~/projects` here is 39 repos and half an hour of scanning.
        // So the count is put in front of somebody before it happens, once, with a way
        // through. A monorepo that vendors submodules is a repo itself and never asks.
        if (added.holds > 1) {
          setBigFolder(added)
          return
        }
        // Remembered so the new project can be selected when it shows up: the scan publishes
        // it and the poll renders it, which are two different moments — without that the repo
        // you just added appears in the list and the map stays on whatever you were looking at.
        //
        // **Priced before it is added, because the answer changes what happens next.** A repo
        // whose history is under the budget is scanned and traced without anybody being asked;
        // one over it arrives with its map drawn and its second axis missing, which is a thing
        // to say out loud rather than let somebody discover from a grey lens. The estimate is
        // free — see `trace::estimate` — so this costs nothing on the repos it does not apply
        // to. A failure to price is not a reason to block an add: fall through and let the row
        // say what it finds.
        void Promise.all([estimateTrace(added.path), explainTrace()])
          .then(([cost, explain]) => {
            if (cost.fits || !explain) {
              takeFolder(added.path, added.key)
              return
            }
            setBigHistory({ added, cost })
          })
          .catch(() => takeFolder(added.path, added.key))
      })
      .catch((e) => {
        setPendingAdd(null)
        setError(String(e))
      })
  }, [takeFolder])

  // File → Open used to raise a folder picker. Opening by hand is gone — a project arrives
  // only when an agent calls `sanity_open` — so the menu item now opens the one thing that
  // can still get you one. Kept rather than deleted because ⌘O is muscle memory, and a
  // shortcut that does nothing teaches people the app is broken.
  // ⌘O adds a repo again, matching what the item now says. It pointed at the connect
  // sheet for as long as adding by hand did not exist.
  useEffect(() => onOpenProject(() => addProject()), [addProject])

  return { addProject, takeFolder }
}
