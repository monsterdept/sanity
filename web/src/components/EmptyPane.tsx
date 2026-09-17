import { useEffect, useState } from 'react'
import { cliStatus, harnesses, installCli, type CliState, type ProjectSummary } from '../lib/api'

/**
 * A project this app knows about and is not holding anything for.
 *
 * **The pane's third answer, and it used to have two.** A repo with a tree gets the map; a
 * repo being scanned gets the wait. A repo with neither — one that has been reset, one whose
 * scan was declined for cost, one whose volume was not mounted when the restore reached it —
 * fell into the wait and sat there reading `Reading tattle…` behind a bar with nothing behind
 * it. Nothing was coming; there was no scan.
 *
 * So it says what is true and offers the one thing that changes it. The path is here because
 * it is the other half of what the app still knows: the name identifies the project and the
 * path is what a reset did NOT touch — the repo is exactly where it was.
 *
 * The estimate rides along where there is one, which is the declined case. It is the reason
 * that project has no tree, so a button offering to scan it anyway has to say what it costs.
 */
export function Unscanned({ project, onScan }: { project: ProjectSummary; onScan: () => void }) {
  const cost = project.scan_cost
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex w-full max-w-[46ch] flex-col gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-8 py-8">
        <div className="flex flex-col gap-1">
          <h2 className="mono text-[15px] text-[var(--foreground)]">{project.name}</h2>
          <p className="mono break-all text-[11px] text-[var(--muted-foreground)]">
            {project.repo}
          </p>
        </div>
        <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
          {cost
            ? 'This repo has not been scanned here — the scan was priced and left for you to start.'
            : 'Nothing has been scanned here yet. The repo is untouched; everything Sanity derived from it is gone.'}
        </p>
        <button
          onClick={onScan}
          className="self-start rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90"
        >
          Scan {project.name}
        </button>
        {cost && (
          // The same two facts the row's pill prints, in the same order and for the same
          // reason — this many files is WHY it is that many seconds.
          <p className="mono text-[11px] text-[var(--muted-foreground)]">
            {cost.files === null ? 'size unknown' : `${cost.files.toLocaleString()} files`} → about{' '}
            {Math.round(cost.seconds)}s
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * The window with no projects in it — which is to say, the first run.
 *
 * What an empty window owes you is the next action, not the premise. It used to open with a
 * headline and a paragraph about what the rings mean: a pitch, on the screen of someone who
 * has already installed the thing.
 *
 * **One step, and that is the news.** This was a two-door choice, then a two-step gate:
 * connect an agent over MCP, then go into a session and say a phrase, offered on a copy
 * button because it had to arrive verbatim in another application. Both shapes were right
 * for a product where a reader had to be a subagent of somebody's chat — only an agent
 * could hold a repo, so only an agent could start anything.
 *
 * Sanity runs the readers itself now. There is nothing to configure, nothing to paste, and
 * no session to enter: add a repo, press Read. MCP is demoted to a second way of pressing a
 * button that is already on this screen, so it is a sentence at the bottom rather than
 * step one.
 *
 * **What replaced the connect step is a prerequisite that can be CHECKED.** "Configure an
 * MCP server" is a thing people get wrong silently; "have claude or codex installed" is a
 * thing this card can look for and state, which is why it does.
 *
 * **The previous version of this docstring was itself a finding.** A reader was handed a
 * description of a choice the body had stopped offering two hours earlier and graded it
 * `some`, noting it had been given a rationale the code overruled — the exact failure the
 * metric exists to expose, on the file that draws the metric's own front door. Hence the
 * care taken to rewrite this one in the same commit as the body.
 *
 * No remembered "declined" flag, deliberately. This screen only exists while there are no
 * projects, so adding one dismisses it for good; a persisted dismissal would be state that
 * can only ever go wrong, guarding a screen nobody will see again anyway.
 */
export function Empty({ onAdd }: { onAdd: () => void }) {
  const [found, setFound] = useState<{ id: string; installed: boolean }[]>([])
  useEffect(() => {
    void harnesses().then(setFound)
  }, [])
  const have = found.filter((h) => h.installed).map((h) => h.id)
  const checked = found.length > 0
  /** What the CLI link attempt said: nothing yet, in flight, the result, or the error. */
  const [linking, setLinking] = useState<
    null | 'working' | string | { path: string; on_path: boolean }
  >(null)
  /** What `sanity` means in a terminal. Null until asked, so the card shows neither state
   *  rather than flashing the wrong one. */
  const [cli, setCli] = useState<CliState | null>(null)
  useEffect(() => {
    void cliStatus().then(setCli)
  }, [])

  return (
    /* Boxed. The copy needs a ground of its own: over bare pane it read as text lying on
       the desk rather than as a card asking for something. */
    <div className="flex h-full items-center justify-center p-8">
      <div className="flex w-full max-w-[54ch] flex-col items-center gap-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] px-8 py-9">
        <h2
          className="font-display text-[26px] font-normal leading-none text-[var(--foreground)]"
          style={{
            fontFamily: "'LINE Seed JP'",
            letterSpacing: '-0.06em',
          }}
        >
          Read your first project
        </h2>

        {/* One step now, and that is the whole change.
            This was a two-step gate: connect an agent over MCP, then go into a session and
            say a phrase, on a copy button, because a reader had to be a subagent of
            somebody's chat and only an agent could name a repo. Sanity runs the readers
            itself now — separate processes, no repo access — so there is nothing to
            configure and nothing to paste. Add a repo and press Read.
            The prerequisite that remains is a coding agent on this machine, which is a
            thing that can be CHECKED rather than explained, so the card checks it. */}
        <div className="flex w-full max-w-[44ch] flex-col gap-4">
          <p className="text-sm leading-relaxed text-[var(--muted-foreground)]">
            Add a repo and Sanity scans it. Expose more detail by using your coding agent as a fleet
            of readers, each in its own process, to rate the predictability and legibility of each
            of your files and functions.
          </p>

          <button
            onClick={onAdd}
            className="self-start rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-foreground)] hover:opacity-90"
          >
            Add a repo
          </button>

          {/* Stated, not explained. A missing agent is the one thing that will stop this
              working, and it is the kind of prerequisite people get wrong silently. */}
          {checked && (
            <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
              {have.length > 0 ? (
                <>
                  Ready to read with{' '}
                  {/* The NAMES take the foreground; the separators stay muted. Joining the
                      list inside one span lit the `+` signs as brightly as the agents, so a
                      row of punctuation read as part of what was found. */}
                  {have.map((h, i) => (
                    <span key={h}>
                      {i > 0 && ' + '}
                      <span className="text-[var(--foreground)]">{h}</span>
                    </span>
                  ))}
                  .
                </>
              ) : (
                <>
                  You will need <code>claude</code> or <code>codex</code> installed and signed in —
                  Sanity reads by running one of them.
                </>
              )}
            </p>
          )}

          {/* Demoted, deliberately. It used to be step one; it is now a second way to press
              a button that is already on screen. */}
          <p className="text-xs leading-relaxed text-[var(--muted-foreground)]">
            You can also start a read from a terminal with <code>sanity check</code>, and watch it
            there. The backend spawns the same readers, no window required.
          </p>

          {/* **The one thing a DMG cannot do for you.** Homebrew puts `sanity` on PATH with
              the cask's own `binary` stanza; a downloaded app is a bundle in /Applications
              and nothing links out of it. `install_cli` has existed the whole time and
              nothing ever called it, so the sentence above named a command a direct-download
              user did not have.
              A button rather than instructions, because the alternative is telling somebody
              to add `Sanity.app/Contents/MacOS` to their PATH — which also puts
              `sanity-scan`, `sanity-history` and two others there — or to write an alias no
              script can see. */}
          <div className="flex flex-col items-start gap-1.5">
            {cli?.is_this_app ? (
              // **A state, not a button.** Offering "Ensure CLI is on PATH" to somebody whose
              // `sanity` already runs this app invites them to fix what is not broken, and
              // the only way to learn the answer was to perform the action.
              <p className="text-xs leading-relaxed text-[var(--agent-mark)]">
                ✓ <code>sanity</code> is on your PATH
              </p>
            ) : (
              <>
                {/* Points at something else. Named rather than silently relinked: the
                    winning entry may be a Homebrew cask's, which this app did not write and
                    cannot remove, and re-linking our own directory would not change which
                    one PATH reaches first. Saying what runs is the part that helps. */}
                {cli?.on_path && cli.resolved && (
                  <p className="text-xs leading-relaxed text-[var(--warning)]">
                    <code>sanity</code> runs a different build — <code>{cli.resolved}</code>
                  </p>
                )}
                <button
                  onClick={() => {
                    setLinking('working')
                    void installCli()
                      .then((r) => {
                        setLinking(r)
                        // Re-asked rather than inferred: `install_cli` knows it wrote a
                        // link, and which `sanity` a SHELL reaches is a different question.
                        void cliStatus().then(setCli)
                      })
                      .catch((e) => setLinking(String(e)))
                  }}
                  className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--secondary)] px-3.5 py-2 text-xs font-semibold hover:opacity-90"
                >
                  {linking === 'working'
                    ? 'Linking…'
                    : cli?.on_path
                      ? 'Point sanity at this app'
                      : 'Ensure CLI is on PATH'}
                </button>
                {linking && linking !== 'working' && typeof linking === 'string' && (
                  <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    {linking}
                  </p>
                )}
                {/* Linked, and still not what a shell reaches — a different directory wins.
                    That is the one outcome somebody has to fix themselves, so it says so
                    instead of showing a tick. */}
                {linking && typeof linking !== 'string' && cli && !cli.is_this_app && (
                  <p className="text-[11px] leading-relaxed text-[var(--muted-foreground)]">
                    Linked at <code>{linking.path}</code>
                    {cli.resolved
                      ? ` — but ${cli.resolved} comes first on your PATH.`
                      : ' — add that directory to your PATH.'}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
