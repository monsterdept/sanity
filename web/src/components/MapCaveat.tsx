import { useMemo } from 'react'
import { type Node } from '../lib/api'
import { type Wedge } from '../lib/sunburst'

/** `n` things, with its share of whatever it is a share OF.
 *
 *  The three clauses in this chip have three different denominators — files that look like
 *  source, files the map holds, directories — and the counts are not comparable across them.
 *  Naming each whole on screen was tried and is not worth its width: a percentage beside a
 *  count is enough to read, and the chip is a caveat rather than a table. */
function outOf(n: number, of: number, noun: string): string {
  return `${n.toLocaleString()} ${noun}${n === 1 ? '' : 's'}${share(n, of)}`
}

/** `n` out of `of`, as a share, for the corner chip — or nothing when there is no `of`.
 *
 *  **Precision follows the value, because one fixed width is wrong at both ends.** Two
 *  decimals everywhere prints `92.30%`, which reads as a measurement to the hundredth that
 *  nobody took; none at all prints `0%` for fifteen thousand files, which is worse than
 *  silence because it is a confident nothing. So the digits appear where they carry the
 *  meaning and stop where they stop.
 *
 *  A share that would round away entirely is printed as `<0.01%` rather than `0.00%`: the
 *  finding at that size is that it is small, and rounding a real count to zero is the same
 *  lie the empty-tally case is. And an unknown denominator prints NOTHING — a bare count is
 *  incomplete, where a count beside a share of an unknown whole is wrong. */
function share(n: number, of: number): string {
  if (of <= 0) return ''
  const p = (n / of) * 100
  if (p > 0 && p < 0.01) return ' (<0.01%)'
  return ` (${p >= 10 ? p.toFixed(0) : p >= 1 ? p.toFixed(1) : p.toFixed(2)}%)`
}

/** What the corner chip is counted against: everything under the focus, and what folding took
 *  out of the picture. */
export function useMapCaveat(root: Node, wedges: Wedge[], collapsed: ReadonlySet<string>) {
  /** Everything under the focus, at any depth — the denominator the corner chip needs.
   *
   *  Its own walk because `layout` has a different job and a different reach: that one stops
   *  at `maxDepth`, since a node past the last ring is neither drawn nor culled, so a total
   *  taken from it would omit exactly the deep tail that makes a share worth printing.
   *
   *  The root itself is not a directory of its own here: it is the thing the share is ABOUT,
   *  and counting it would make a repo with no subdirectories report one. */
  const under = useMemo(() => {
    const n = { files: 0, dirs: 0 }
    const walk = (x: Node) => {
      if (x.kind === 'file') n.files += 1
      else if (x.kind === 'dir') n.dirs += 1
      x.children.forEach(walk)
    }
    root.children.forEach(walk)
    return n
  }, [root])

  /** What folding has taken out of the picture: the folded directories that are actually
   *  drawn, and the share of this view's lines they stand for.
   *
   *  **The share is the price of the handle and has to be stated somewhere.** A fold hands
   *  a subtree's angle to its siblings, so every remaining wedge is now larger than its
   *  lines have earned — and the amount they are wrong by is exactly this number. Against
   *  the VIEW's own lines rather than the repo's, because the circle is the view: drilled
   *  into `src`, "62% of what you are looking at" is the honest sentence and "8% of the
   *  repo" is an answer to a question nobody asked here.
   *
   *  Only what is drawn is counted. A directory folded and then drilled past is not
   *  suppressing anything in the ring you are looking at, and putting it in this total
   *  would attach a caveat to a picture that does not have the problem. */
  const foldedInfo = useMemo(() => {
    if (collapsed.size === 0) return null
    const shut = wedges.filter((w) => w.node.kind === 'dir' && collapsed.has(w.node.id))
    if (shut.length === 0) return null
    const loc = shut.reduce((sum, w) => sum + w.node.loc, 0)
    return {
      count: shut.length,
      name: shut.length === 1 ? shut[0].node.name : null,
      share: root.loc > 0 ? loc / root.loc : 0,
    }
  }, [wedges, collapsed, root.loc])
  return { under, foldedInfo }
}

/** The caveat in the corner: what the picture is not showing, and the way back for what the
 *  reader hid. Nothing when nothing is missing. */
export function MapCaveat({
  root,
  hidden,
  collapsed,
  under,
  foldedInfo,
  onUnfold,
}: {
  root: Node
  hidden: { files: number; dirs: number }
  collapsed: ReadonlySet<string>
  under: ReturnType<typeof useMapCaveat>['under']
  foldedInfo: ReturnType<typeof useMapCaveat>['foldedInfo']
  onUnfold: () => void
}) {
  return (
    <>
      {/* Every count in the chip below is meaningless without the number it is out of.
          15,777 is 0.26% of one repo and 92.3% of another, and those are opposite findings
          wearing the same digits — which is this app's own rule about denominators nobody
          can see, applied to its own caption.

          Counted here rather than in `layout`, which cannot answer it: that walk stops at
          `maxDepth`, so anything past the last ring is neither drawn nor culled and would be
          missing from a total it computed. A share is only honest against its whole
          population. */}
      {(hidden.files + hidden.dirs > 0 || collapsed.size > 0 || (root.unparsed ?? 0) > 0) && (
        /* Never let the picture imply it showed everything.
           Two different omissions live here and they are not the same kind of thing.
           Wedges too thin to draw are the tool's doing and there is nothing to be done
           about them, so they are stated and left. Files the walk could not parse are the
           tool's doing too, and they are a heavier claim than the other two: a thin wedge is
           still counted in every total above it, where an unreadable file is in no
           denominator anywhere. A repo of 110 `.scad` files and 3 `.rb` drew three files and
           said nothing, which is the confident-looking half-verdict the no-git-history
           warning already exists to prevent, reached through a door that had no warning on
           it. From `root`, so it scopes to the drill the way `hidden` does — see
           `Node::unparsed`, which is rolled up for exactly this. A FOLDED directory is the reader's own
           doing — and it was missing from this note entirely, which is the worse of the
           two: option-clicking a subtree shut removes it from the picture with no standing
           record that it is gone, and the count of what the map is showing quietly stops
           meaning what it did. Somebody returning to a window they folded an hour ago has
           no way to tell a repo without tests from a repo whose tests they hid.

           So it says both, and the one the reader can undo carries the way to undo it.
           Boxed in the corner rather than floated under the graph: it is a caveat about
           the picture, so it reads as a note attached to it and not a caption of it. */
        <div className="absolute bottom-2 left-2 flex items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] px-2 py-1 text-[11px] text-[var(--muted-foreground)]">
          {/* **One clause on the first line, the rest on the second, and the reason is the
              shape of the hole it sits in.** The map is a circle in a rectangle, so the
              negative space at this corner WIDENS as it goes down — the arc curves away from
              the bottom-left as it descends. A single 450px line runs out along the widest
              part of the picture; two lines put the short clause where the room is narrow and
              everything else where the room is. The legend does the same thing on the other
              side by measuring the arc (`useMapEdge`), which is worth remembering if this
              ever needs to be exact rather than merely true.

              `CHROME_BOTTOM` is untouched: it reserves room under the COMPOSITION, and the
              second line grows into a corner the rings were never reaching. If that ever
              stops holding, the fix is the one that constant's own doc asks for — measure
              the overlay and convert through `unitsPerPx` — not a bigger fraction. */}
          <span className="flex flex-col">
            {[
              // **Named and priced, not counted.** `1 dir folded` was enough while a fold
              // only hid a subtree's insides; now it hands that subtree's angle to its
              // siblings, and a reader coming back to this window an hour later has to be
              // able to find out which ring is no longer proportional and by how much. One
              // fold names itself, because the name is what makes it findable; several are
              // a count, because a list of names in a corner chip is not read.
              foldedInfo &&
                `${
                  foldedInfo.name
                    ? `${foldedInfo.name} folded`
                    : `${foldedInfo.count.toLocaleString()} dirs folded`
                }${foldedInfo.share >= 0.005 ? ` — ${Math.round(foldedInfo.share * 100)}% of this view` : ''}`,
              // Undefined, not zero, on a replayed frame and on a scan still streaming its
              // shape: neither knows what the walk could not read, so neither says. See
              // `Node.unparsed`.
              (root.unparsed ?? 0) > 0 &&
                // Out of every file that LOOKS like source here — the ones drawn plus the
                // ones that could not be read. Not out of the drawn files alone, which would
                // put the part outside the map over a denominator that excludes it and let
                // the share run past 100%.
                //
                // A third population is in neither: files the parser opened and got nothing
                // from (`ScanStats::files_skipped`, 1,671 of ceph's 7,813) become no node, so
                // they are missing from the denominator and the share reads a few points high
                // — 16% against a true 13% there. Counting them would mean carrying that
                // number per node too, which is more machinery than three points is worth;
                // the direction of the error is stated here instead of implied.
                `${outOf(root.unparsed!, under.files + root.unparsed!, 'file')} not parsed`,
              hidden.files > 0 &&
                // Out of the drawn population only: a culled wedge is a file the map HAS and
                // did not show, so the files it could not read are not part of this question.
                `${outOf(hidden.files, under.files, 'file')} too thin`,
              hidden.dirs > 0 && `${outOf(hidden.dirs, under.dirs, 'dir')} too thin`,
            ]
              .filter((c): c is string => typeof c === 'string')
              // The first alone, then everything else together. Not a wrap: a wrap breaks
              // wherever the width runs out, which puts half of one count on each line and
              // reads as a rendering fault. The break is between clauses or it is nowhere.
              .reduce<string[]>(
                (lines, clause, i) =>
                  i === 0 ? [clause] : [lines[0], lines[1] ? `${lines[1]} · ${clause}` : clause],
                [],
              )
              .map((line) => (
                <span key={line}>{line}</span>
              ))}
          </span>
          {collapsed.size > 0 && (
            <button
              type="button"
              className="rounded-[var(--radius-sm)] px-1 text-[var(--foreground)] underline decoration-dotted underline-offset-2 hover:bg-[var(--secondary)]"
              onClick={onUnfold}
            >
              unfold all
            </button>
          )}
        </div>
      )}
    </>
  )
}
