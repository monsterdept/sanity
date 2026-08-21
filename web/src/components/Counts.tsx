import { compactCount } from '../lib/text'
import type { Node } from '../lib/api'

/**
 * What the subject is made of: lines, functions, commits.
 *
 * One component rather than a line in each pane, for the reason the dial row was one: the
 * repo, a directory, a file and a function all print this under their name, and a row that
 * lives inside one of its callers is how two panes end up with two versions of it. That is
 * not hypothetical here — the repo header printed three figures, a directory printed two,
 * and a function printed none.
 *
 * **A function omits the function count and nothing else.** It is not made of functions; it
 * is one. Everything else in the tree is a subtree and answers all three.
 *
 * **A commit count means two different things and the label has to say which.** For a repo,
 * a directory or a file it is every commit that has ever touched that path — one walk of
 * `git log`, counting a commit once per subtree however many of its files it touched. For a
 * function there is no such number without `git log -L`, a process apiece, so what it has is
 * what blame can see: how many distinct commits its current lines TRACE BACK TO. `blame.rs`
 * states the difference and asks the UI not to print the two as one number; the UI did
 * exactly that for months, labelling both `in 90d` — which neither of them was.
 *
 * **No history means no segment, never a zero.** A zero says nobody has touched this; the
 * truth is that nothing here can tell.
 */
export function Counts({
  node,
  functions,
  excluded = 0,
}: {
  node: Node
  /** How many functions are under here. Left out on a function, which is one. */
  functions?: number
  excluded?: number
}) {
  const s = node.score
  /** Every commit that ever touched this path. Absent on a function and on anything git has
   *  never seen — see `Score.allCommits`. */
  const all = s?.allCommits ?? null
  /** A function's own figure: the commits its lines trace back to. `ageDays` is the gate
   *  because without history there is no answer, and `commits` would read as a flat 0. */
  const traced = node.kind === 'func' && s && s.ageDays !== null ? s.commits : null
  return (
    /* One shape for what a thing IS: lines, functions, commits — the same three the history
       header prints, so switching between them is not switching layouts. `compactCount`
       keeps it on one line whatever the project's size; a header that wraps on a big repo
       and not a small one is a layout tested against one repo. */
    <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
      {compactCount(node.loc)} lines
      {functions !== undefined && (
        <>
          {' '}
          · {compactCount(functions)} {functions === 1 ? 'function' : 'functions'}
        </>
      )}
      {all !== null ? (
        <span title="Every non-merge commit that has ever touched this path. A commit counts once for a directory however many of its files it changed.">
          {' '}
          · {compactCount(all)} {all === 1 ? 'commit' : 'commits'}
        </span>
      ) : (
        traced !== null && (
          <span title="Blame reports the last commit to touch each line, so this is how many distinct commits the lines standing here came from — not how many edits this function has seen. A per-function history needs `git log -L`, which follows a moving line range through every diff.">
            {' '}
            · traces to {compactCount(traced)} {traced === 1 ? 'commit' : 'commits'}
          </span>
        )
      )}
      {/* Never on its own line and never omitted: `functions` is what the readings below are
          counted against, and a denominator somebody narrowed months ago has to be visible
          beside it. */}
      {excluded > 0 && (
        <span title=".sanityignore set these aside: still drawn, never queued.">
          {' '}
          · {excluded.toLocaleString()} excluded
        </span>
      )}
    </p>
  )
}
