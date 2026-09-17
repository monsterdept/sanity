import { useEffect, useState } from 'react'
import { repoRemote } from '../lib/api'

/** The repo's remote as `owner/name`, for the caption on an exported movie — or null
 *  where there is no remote to name.
 *
 *  Asked once per repo rather than carried on the project row: it is one `git` call, the
 *  only thing that reads it is an export, and a field on a row that is re-fetched on a
 *  poll is a value re-fetched on a poll. */
export function useRemote(repoPath: string | null): string | null {
  const [remote, setRemote] = useState<string | null>(null)
  useEffect(() => {
    setRemote(null)
    if (!repoPath) return
    let live = true
    void repoRemote(repoPath).then((r) => {
      if (live) setRemote(r)
    })
    return () => {
      live = false
    }
  }, [repoPath])
  return remote
}
