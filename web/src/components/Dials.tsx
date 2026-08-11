import {
  DOC_GAP,
  DOC_WORDS,
  GRADE_SURPRISE,
  LEGIBLE_WORDS,
  heatColor,
  isAnalyzed,
  readingWords,
  showsShare,
  wedgeHeat,
  type Grade,
  type Node,
  type Ramp,
} from '../lib/api'

/**
 * One reading, as a dial.
 *
 * Three of these side by side, where there were four stacked bars. A bar is a length, and
 * three lengths in a column invite the eye to compare them — but these three measure
 * different things on different scales, so comparing them is exactly the reading nobody
 * should take. A dial reads as its own instrument: you take each one on its own terms,
 * which is what they are.
 *
 * Fixed 180°, and the value spelled out in the middle. The arc is for the glance — is this
 * near the top or the bottom — and the number is there because a glance at an arc is not a
 * measurement and this panel is where you come when the map was not enough.
 *
 * **Each dial wears its own lens's ramp, at its own value.** They were all `--accent`, so
 * the loudest property on the row carried nothing — the one place in this app where colour
 * meant nothing at all — while four feet below, the same four readings each had a hue of
 * their own that the whole map is built on. A dial is now literally the colour that wedge
 * takes when you press that tab, which makes the row a preview of the four lenses rather
 * than a chart-shaped decoration.
 *
 * Lives here rather than in `Detail` because the row is on every pane that describes a
 * subtree — the repo, a directory, a file, a function — and a component defined inside one
 * of its callers is how two panes end up with two dial rows that drift apart.
 */
export function Gauge({
  label,
  value,
  hint,
  ramp,
  unread,
  word,
}: {
  label: string
  /** 0..1, and it is the RAMP's input, not "how good this is". The docs ramp paints the
   *  gap, so a well-documented function passes a small number here and gets a calm colour;
   *  see `--docs-*`. */
  value: number
  hint: string
  /** Which lens this reading belongs to. Undefined for a figure with no lens behind it. */
  ramp?: Ramp
  /** No value to show — draw the track and say so, rather than a needle at zero, which
   *  claims a reading of nought where there is no reading at all. */
  unread?: boolean
  /** Say it in words instead of digits, for a reading that has four steps and no more.
   *
   *  The arc stays: it is the glance, and it wants the uneven spacing that makes `cold`
   *  and `warm` sit close together. It is the printed number that was the problem —
   *  `62` reads as a measurement to one part in a hundred, and four wedges at `30` look
   *  like four measurements agreeing rather than one grade repeated. */
  word?: string | null
}) {
  const R = 40
  const LEN = Math.PI * R
  const v = Math.max(0, Math.min(1, value))
  const arc = `M ${50 - R} 50 A ${R} ${R} 0 0 1 ${50 + R} 50`
  // A ramp colour when the reading has a lens, the chrome's accent when it does not.
  const fill = unread ? 'var(--secondary)' : ramp ? heatColor(v, ramp) : 'var(--accent)'
  return (
    <div className="flex min-w-0 flex-col items-center" title={hint}>
      <svg viewBox="0 0 100 58" className="w-full overflow-visible">
        {/* The track, quieter than it was. It used to be `--secondary` at the same weight as
            the value arc, so at 5% documented the picture was dominated by the part that is
            not the reading — a big grey horseshoe with a nub on it. Thinner and dimmer: the
            track is the scale, the arc is the answer. */}
        <path
          d={arc}
          fill="none"
          stroke="var(--border)"
          strokeWidth={4}
          strokeLinecap="round"
        />
        {!unread && (
          <path
            d={arc}
            fill="none"
            stroke={fill}
            strokeWidth={7}
            // Butt at zero: a round cap on an empty arc draws a dot, which reads as a
            // small value rather than none.
            strokeLinecap={v > 0.01 ? 'round' : 'butt'}
            strokeDasharray={`${LEN * v} ${LEN}`}
          />
        )}
        {/* One size for words and numbers. They were 15 and 22, so a row holding both —
            which is most rows — had two type sizes competing inside one instrument, and the
            dial reading `warm` looked like the quieter measurement. It is the same reading
            either way; only its scale differs. */}
        <text
          x={50}
          y={47}
          textAnchor="middle"
          className="mono"
          fontSize={16}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {unread ? '—' : (word ?? Math.round(v * 100))}
        </text>
      </svg>
      {/* Wraps rather than overflows. At three columns every label was one short word; at
          four, `UNDOCUMENTED` is wider than its column and ran into `HOT SHARE` beside it.
          `break-words` lets the long ones take two lines, and the tracking comes off so
          they need fewer — a label that collides is worse than a label set slightly tighter
          than its neighbours. */}
      <span className="mt-0.5 w-full cursor-help break-words text-center text-[9px] font-semibold uppercase leading-tight tracking-tight text-[var(--muted-foreground)]">
        {label}
      </span>
    </div>
  )
}

/** A reader's grade, for the two dials that have one, or undefined. */
function graded(node: Node, which: 'legible' | 'documented'): Grade | undefined {
  // Files as well as functions: a file carries its own reading now, and its header's grade
  // is what the Undocumented dial should show for it rather than an average of what is
  // inside. `legible` is never set on a file reading — see `FILE_ASK` — so it returns
  // undefined there and the dial reads as unread, which is the truth.
  if (!matches(node) || !node.agent || node.agentStale) return undefined
  if (which === 'documented') {
    return node.agent.derivable ? 'none' : (node.agent.documented ?? undefined)
  }
  return node.agent.legible ?? undefined
}

/** The share of a directory's FILES whose header does not describe them — the twin of
 *  `undocShare` in `colorMode`, counted by reading rather than weighted by lines. */
function fileDocShare(node: Node): number | null {
  let read = 0
  let bare = 0
  const walk = (n: Node) => {
    if (n.kind === 'file') {
      const g = graded(n, 'documented')
      if (g) {
        read += 1
        if (g === 'some' || g === 'none') bare += 1
      }
    }
    n.children.forEach(walk)
  }
  walk(node)
  return read === 0 ? null : bare / read
}

/** Which nodes can carry a reading of their own. */
function matches(n: Node): boolean {
  return n.kind === 'func' || n.kind === 'file'
}

/** The share of a subtree's graded lines that came back on the wrong side of a grade.
 *  One walk for both lenses, matching `opaqueShare` and `undocShare` in `colorMode` —
 *  which is what keeps a dial and the wedge it describes telling the same story. */
function badShare(node: Node, which: 'legible' | 'documented'): number | null {
  let graded_ = 0
  let bad = 0
  const walk = (n: Node) => {
    if (n.kind === 'func') {
      const g = graded(n, which)
      if (g) {
        graded_ += n.loc
        if (g === 'some' || g === 'none') bad += n.loc
      }
    }
    n.children.forEach(walk)
  }
  walk(node)
  return graded_ === 0 ? null : bad / graded_
}

/**
 * What was measured of this subtree, whatever the subtree is.
 *
 * **Always four, and always the same four.** The row used to be three or four depending on
 * whether this particular node had a legibility grade, so one pane had two layouts and the
 * columns moved under the cursor. Worse, containers could never reach the fourth at all —
 * not because a directory has no opacity, but because `Score` has no `legible` field and
 * nobody had asked the readings underneath. `opaqueShare` had been computing exactly that
 * number for the Opacity lens the whole time.
 *
 * A dial with nothing behind it draws its track and an em dash. That is the honest state
 * and it is why the row can be fixed at four: an absent measurement is a thing to say, not
 * a thing to hide by reflowing around it.
 */
export function Dials({ node }: { node: Node }) {
  const s = node.score
  if (!s || !isAnalyzed(node)) return null
  const share = showsShare(node)
  const words = readingWords(node)

  const legible = share ? badShare(node, 'legible') : null
  const legibleGrade = graded(node, 'legible')
  // By reading, not by line — matching `undocShare` in `colorMode`, and for the same
  // reason: a file's own reading carries the whole file's line count.
  const docs = node.kind === 'dir' ? fileDocShare(node) : null
  const docGrade = graded(node, 'documented')

  return (
    // Under its own full-bleed rule, the same one the section below it gets. The dials are
    // a section of the pane rather than a continuation of the header — what the thing IS
    // above the line, what was measured of it below — and without the rule they read as a
    // third line of the header set in a much larger type.
    <div className="-mx-4 mt-4 grid shrink-0 grid-cols-4 gap-1 border-t border-[var(--border)] px-4 pt-3">
      {/* Surprise. A container reports the share of its analysed lines sitting in hot code
          — `wedgeHeat` — which is the figure its wedge is painted with, so the dial and the
          ring agree. A function reports its own temperature. */}
      <Gauge
        label={share ? 'Hot share' : 'Surprise'}
        value={wedgeHeat(node)}
        ramp="heat"
        word={words?.heat}
        hint={
          share
            ? 'The share of analysed lines under here sitting in hot code — the figure this wedge is coloured by.'
            : 'How little of this body a reader could predict from its name, signature, neighbours and docs. This is the colour. A reader’s judgement has four steps, so it is named rather than numbered — a printed 62 would invite a comparison the scale cannot make.'
        }
      />
      {/* Documentation is a REPORT, not a discount. It no longer multiplies into the colour
          — the reader who graded it had the docs in hand, so a good comment already lowered
          the surprise beside it. Shown because "surprising and undocumented" and
          "surprising but well covered" are different situations, and only one of them is
          anyone's fault.

          The VALUE is the gap, because that is what the ramp paints and what the lens is
          named for. The WORD is still the coverage grade a reader gave, which is the thing
          they actually said. */}
      {/* The same question the Docs lens paints, at whichever level this node is: a
          function or a file answers for its own doc, a directory for the share of its files
          nobody has described. A dial that averaged something else would disagree with the
          wedge it is standing next to. */}
      <Gauge
        // Named for what the dial PRINTS, not for what the ramp paints. A function shows
        // the reader's coverage grade (`most`), a directory the share of its files nobody
        // described — the colour runs the other way in both, because bright is what wants
        // doing, and the hint says so.
        label={node.kind === 'dir' ? 'Files undescribed' : 'Documented'}
        value={
          node.kind === 'dir'
            ? (docs ?? 0)
            : docGrade
              ? DOC_GAP[docGrade]
              : 1 - s.documented
        }
        ramp="docs"
        unread={node.kind === 'dir' ? docs === null : !docGrade && share}
        word={node.kind === 'dir' ? null : docGrade ? DOC_WORDS[docGrade] : null}
        hint="How much of what this code does nobody has explained — graded by the reader that read both the docs and the body, not counted in comment lines. A directory reports the share of its files whose header does not describe them; a doc the reader judged derivable from the code reads none, whatever grade it gave."
      />
      {/* The second axis. Surprise alone cannot tell a subtle algorithm from a mess — both
          are unpredictable — and churn is what separates them.

          Drawn as an empty dial reading "—" without git history, not as a needle at zero:
          no history means no second axis at all, and a zero claims "settled" where the
          truth is "unknown". */}
      <Gauge
        label="Churn"
        value={s.churn}
        ramp="churn"
        unread={s.ageDays === null}
        hint="How much this code has moved lately. Without git history there is no second axis, and the dial says so rather than reading zero."
      />
      {/* The other half of the reading, and the reason the pair is worth having: this one
          is graded AFTER opening the body, where Surprise is graded before. A function that
          reads hot there and plain here is unreachable rather than unreadable, which is a
          documentation problem and not a code one. */}
      <Gauge
        label="Opacity"
        value={share ? (legible ?? 0) : legibleGrade ? GRADE_SURPRISE[legibleGrade] : 0}
        ramp="legible"
        unread={share ? legible === null : !legibleGrade}
        word={share ? null : legibleGrade ? LEGIBLE_WORDS[legibleGrade] : null}
        hint="How clear the body was once the reader had opened it — the second axis. Surprise asks whether the intent was reachable from outside; this asks what was there when they looked."
      />
    </div>
  )
}
