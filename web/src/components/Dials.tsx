import type { ReactNode } from 'react'
import {
  DOC_GAP,
  DOC_WORDS,
  GRADE_SURPRISE,
  HEAT_WORDS,
  LEGIBLE_WORDS,
  heatColor,
  isAnalyzed,
  legibleOf,
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
  rampValue,
  hint,
  ramp,
  unread,
  word,
}: {
  label: string
  /** 0..1 — what the dial PRINTS, and how far its arc sweeps. */
  value: number
  /** 0..1 — where the ramp is sampled, when that is not the same thing.
   *
   *  Two dials count up for the good end (`Doc'd`, `Legible`) while their ramps must still
   *  paint the gap, because bright means "there is work here" on every lens and that is not
   *  a per-dial choice. Everywhere else the two are one number and this is left out. */
  rampValue?: number
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
  // A ramp colour when the reading has a lens, the chrome's accent when it does not. Sampled
  // at `rampValue` where the printed number counts the other way — see the prop.
  const c = Math.max(0, Math.min(1, rampValue ?? value))
  const fill = unread ? 'var(--secondary)' : ramp ? heatColor(c, ramp) : 'var(--accent)'
  // What the middle actually reads, worked out once so the fit below can measure it.
  const shown = unread ? '—' : (word ?? String(Math.round(v * 100)))
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
        {/* One size for words and numbers — they were 15 and 22, so a row holding both, which
            is most rows, had two type sizes competing inside one instrument and the worded
            dial read as the quieter measurement. It is the same reading either way; only its
            scale differs.

            Shrunk to fit rather than clipped or truncated. The words are the ones `.sanity/`
            prints now, and `unrecognisable` is fourteen characters where `warm` was four — a
            fixed size would have run it off both ends of the arc. A name a reader cannot
            finish is worse than one set a little smaller, and this is the same fit-or-shrink
            the wedge labels make. */}
        <text
          x={50}
          y={47}
          textAnchor="middle"
          className="mono"
          fontSize={Math.min(16, 88 / Math.max(1, String(shown).length * 0.58))}
          fontWeight={600}
          fill="var(--foreground)"
        >
          {shown}
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

/**
 * A grade as its rung out of four — `2/4` — which is what the dial prints for a reading.
 *
 * It printed the WORD, and the word is the better description and the worse readout. Four
 * dials in a row each held a different vocabulary — `typical`, `decent`, `—` — so the row
 * had nothing in common down its middle and the one dial with a number in it (`CHURN 38`)
 * read as the only real measurement among three labels. A fraction says the two things the
 * word cannot at a glance: that this scale has exactly four steps, and which of them this
 * is. The word is still what a reader said, so it moves into the tooltip rather than out of
 * the app.
 *
 * **Direction follows the dial's own number, not the ramp.** Surprise counts UP toward
 * surprising, because a container's surprise dial is a percentage that does; Docs and
 * Legibility count up toward the good end, because theirs do. That is the same rule the
 * printed number already obeyed — the colour is the thing that always paints the gap.
 */
const RUNG_GOOD: Record<Grade, number> = { full: 4, most: 3, some: 2, none: 1 }
const RUNG_HOT: Record<Grade, number> = { full: 1, most: 2, some: 3, none: 4 }

function fraction(rung: number): string {
  return `${rung}/4`
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
  // Through `legibleOf`, so a grade whose question has been rewritten reads as ungraded here
  // exactly as it does on the map. A dial that kept counting it would be the sidebar telling
  // you 100% legible over a ring that had gone grey.
  return legibleOf(node.agent)
}

/** The share of everything underneath — files AND functions — that nobody has described.
 *  The twin of `undocShare` in `colorMode`, counted by reading rather than weighted by
 *  lines, and over the same population: a dial counting files above a list counting
 *  functions is how one pane came to say 100% and 8-of-13 about the same directory. */
function fileDocShare(node: Node): number | null {
  let read = 0
  let bare = 0
  const walk = (n: Node) => {
    if (n.kind === 'file' || n.kind === 'func') {
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
export function Dials({ node, lead }: { node: Node; lead?: ReactNode }) {
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
  /** The surprise grade, when a reader gave one — the same fold `readingWords` applies, so a
   *  reading banked before the grades existed still lands on an end of the scale rather than
   *  falling through to a percentage. */
  const predicted: Grade | undefined =
    node.kind === 'func' && node.agent && !node.agentStale
      ? (node.agent.predicted ?? (node.agent.surprised ? 'none' : 'full'))
      : undefined

  return (
    // Under its own full-bleed rule, the same one the section below it gets. The dials are
    // a section of the pane rather than a continuation of the header — what the thing IS
    // above the line, what was measured of it below — and without the rule they read as a
    // third line of the header set in a much larger type.
    <div className="-mx-4 mt-4 shrink-0 border-t border-[var(--border)] px-4 pt-3">
      {/* What the thing is MADE OF belongs with what was measured of it, not with its name.
          Lines, functions and commits sat in the header, so the rule fell between the
          counts and the dials — two rows of numbers about the same subject, split by the
          one line in the pane that means "different section". */}
      {lead}
      <div className="grid grid-cols-4 gap-1">
      {/* Surprise. A container reports the share of its analysed lines sitting in hot code
          — `wedgeHeat` — which is the figure its wedge is painted with, so the dial and the
          ring agree. A function reports its own temperature. */}
      {/* Adjectives on containers, nouns on functions, and the difference is not cosmetic:
          a container prints a PERCENTAGE and a function prints a WORD.
          `SURPRISING 15` reads as "15% surprising", which is what the number is; `SURPRISE
          predictable` reads as the axis and the reader's grade, which is what those are.
          One label for both would be wrong for one of them — `SURPRISING predictable` says
          the opposite of itself. */}
      <Gauge
        label={share ? 'Surprising' : 'Surprise'}
        value={wedgeHeat(node)}
        ramp="heat"
        word={predicted ? fraction(RUNG_HOT[predicted]) : words?.heat}
        hint={
          share
            ? 'The share of analysed lines under here sitting in surprising code — the figure this wedge is coloured by.'
            : `How little of this body a reader could predict from its name, signature, neighbours and docs. This is the colour. Four steps, counting up toward surprising: 1 predictable, 2 typical, 3 quirky, 4 obscure.${
                predicted ? ` This one: ${HEAT_WORDS[predicted]}.` : ''
              }`
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
      {/* The same question the Docs lens paints, at whichever level this node is: a function
          or a file answers for its own doc, a directory for its files.

          **The NUMBER counts up for the good thing; the COLOUR still paints the gap.** A
          directory reads `DOC'D 47`, and the ramp beside it is bright because 53% is not.
          Those are two facts, not a contradiction: the number says how much you have, the
          colour says whether there is work. Naming the dial `Files undescribed` and printing
          the gap made the row read one way and the label another — `LEGIBILITY 0` meant
          perfectly legible, which is the opposite of what it says. */}
      <Gauge
        label={node.kind === 'dir' ? "Doc'd" : 'Docs'}
        value={
          node.kind === 'dir'
            ? 1 - (docs ?? 0)
            : docGrade
              ? DOC_GAP[docGrade]
              : 1 - s.documented
        }
        // The ramp always takes the GAP, whatever the number says — bright is the end with
        // work in it, on every lens, and that invariant is not a per-dial decision.
        rampValue={
          node.kind === 'dir' ? (docs ?? 0) : docGrade ? DOC_GAP[docGrade] : 1 - s.documented
        }
        ramp="docs"
        unread={node.kind === 'dir' ? docs === null : !docGrade && share}
        word={node.kind === 'dir' ? null : docGrade ? fraction(RUNG_GOOD[docGrade]) : null}
        hint={`How much of what this code does somebody has explained — graded by the reader that read both the docs and the body, not counted in comment lines. Four steps, counting up toward covered: 1 none, 2 some, 3 decent, 4 full. A directory reports the share of its files whose header describes them instead; a doc the reader judged derivable from the code counts as none, whatever grade it gave. The colour runs the other way: bright is the part nobody has written.${
          docGrade ? ` This one: ${DOC_WORDS[docGrade]}.` : ''
        }`}
      />
      {/* The second axis. Surprise alone cannot tell a subtle algorithm from a mess — both
          are unpredictable — and churn is what separates them.

          Drawn as an empty dial reading "—" without git history, not as a needle at zero:
          no history means no second axis at all, and a zero claims "settled" where the
          truth is "unknown". */}
      <Gauge
        label={share ? 'Churning' : 'Churn'}
        value={s.churn}
        ramp="churn"
        unread={s.ageDays === null}
        hint="How much this code has moved lately. Without git history there is no second axis, and the dial says so rather than reading zero."
      />
      {/* The other half of the reading, and the reason the pair is worth having: this one
          is graded AFTER opening the body, where Surprise is graded before. A function that
          reads hot there and plain here is unreachable rather than unreadable, which is a
          documentation problem and not a code one. */}
      {/* Same construction as Doc'd, and for the same reason: `LEGIBILITY 0` read as
          illegible while meaning nothing was tangled at all. */}
      <Gauge
        label={share ? 'Legible' : 'Legibility'}
        value={share ? 1 - (legible ?? 0) : legibleGrade ? GRADE_SURPRISE[legibleGrade] : 0}
        rampValue={share ? (legible ?? 0) : legibleGrade ? GRADE_SURPRISE[legibleGrade] : 0}
        ramp="legible"
        unread={share ? legible === null : !legibleGrade}
        word={share ? null : legibleGrade ? fraction(RUNG_GOOD[legibleGrade]) : null}
        hint={`What reading this was like, judged by what the reader actually did. Four steps, counting up toward clear: 1 unclear, 2 tangled, 3 nuanced, 4 clean. Surprise asks whether the intent was reachable from outside; this asks what was there when they looked. The colour runs the other way: bright is the tangled end.${
          legibleGrade ? ` This one: ${LEGIBLE_WORDS[legibleGrade]}.` : ''
        }`}
      />
      </div>
    </div>
  )
}
