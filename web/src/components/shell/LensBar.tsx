import type { ProjectSummary } from '../../lib/api'
import type { AgeRead, BlameRead, ColorMode, DerivableRead, TangleRead, Views } from '../../lib/colorMode'
import type { Locked } from '../../lib/locks'
import { isCapped, type Capped } from '../../lib/palette'
import { Lock, ModeSwitcher } from '../ColorKey'
import { HelpButton } from '../LensHelp'
import {
  AgeReading,
  BlameReading,
  ChurnWindow,
  ColorCount,
  CONTROL_H,
  DerivableReading,
  MarkerToggle,
  RingCount,
  TangleReading,
} from '../Rings'

/** The top row's controls, left to right: what the color means, what the picture is, and the
 *  two doors out of it.
 *
 *  Only mounted once there is a map to describe — every control here is a statement about the
 *  picture on screen, and a strip of them over an empty pane would be describing nothing. */
export function LensBar({
  helping,
  setHelping,
  viewMode,
  setMode,
  locks,
  caps,
  chooseCap,
  markers,
  setMarkers,
  ageRead,
  setAgeRead,
  tangleRead,
  setTangleRead,
  blameRead,
  setBlameRead,
  derivable,
  setDerivable,
  lensViews,
  setChurnAt,
  rings,
  chooseRings,
  historyOn,
  historyBusy,
  activeProject,
  toggleHistory,
  finding,
  findingsOpen,
  setFinding,
}: {
  helping: boolean
  setHelping: (on: boolean) => void
  viewMode: ColorMode
  setMode: (m: ColorMode) => void
  locks: Partial<Record<ColorMode, Locked>>
  caps: Record<Capped, number>
  chooseCap: (m: Capped) => (n: number) => void
  markers: boolean
  setMarkers: (on: boolean) => void
  ageRead: AgeRead
  setAgeRead: (r: AgeRead) => void
  tangleRead: TangleRead
  setTangleRead: (r: TangleRead) => void
  blameRead: BlameRead
  setBlameRead: (r: BlameRead) => void
  derivable: DerivableRead
  setDerivable: (r: DerivableRead) => void
  lensViews: Views
  setChurnAt: (i: number) => void
  rings: number
  chooseRings: (n: number) => void
  historyOn: boolean
  historyBusy: boolean
  activeProject: ProjectSummary | null
  toggleHistory: () => void
  finding: boolean
  findingsOpen: boolean
  setFinding: (on: boolean) => void
}) {
  return (
    /* Full width, so the spacers have room to push into — see `Spacer`.
       **And a drag region itself, because it covers the one that was there.**
       `TopRow` is the handle, but Tauri drags only when the EVENT TARGET carries
       the attribute, and this child spans the whole strip — so every pixel of it
       that is not a control was targeting a plain div and the titlebar had no grip
       left. That includes the `gap-2` between every control and the `px-3` at both
       ends, which is most of the empty chrome up here. Children keep taking their
       own clicks: a button is the target when a button is hit. */
    <div data-tauri-drag-region className="flex w-full items-center gap-2 px-3">
      {/* Disabled rather than hidden while the replay is up. The switcher is the
        window's statement of what color means, and removing it would leave the
        rings recolored with nothing on screen saying by what. Grayed, with the
        reason in the tooltip, it still answers the question. */}
      {/* **Two kinds of choice, and the row is arranged by which is which.**
          What the color MEANS goes left; what the picture IS — how much of the
          tree, how thick a band — floats in the middle; the two doors out of it go
          right.

          Help findings, because it explains the control it sits before and a question
          mark after the thing it answers reads as an afterthought. It is also the
          one control here that is about the app rather than about this repo, which
          is the corner of a toolbar it belongs in. */}
      <HelpButton on={helping} onOpen={() => setHelping(true)} />
      <ModeSwitcher mode={viewMode} onMode={setMode} locked={locks} />
      {/* **With the lens, because it is a lens control.** It only exists on the two
          categorical lenses, and what it changes is what a color MEANS — eight
          people and a gray "other", or four hundred and confetti. That is the
          switcher's kind of statement, not the ring count's: rings and band change
          the geometry, and this changes the encoding. */}
      {isCapped(viewMode) && (
        <ColorCount mode={viewMode} cap={caps[viewMode]} onCap={chooseCap(viewMode)} />
      )}
      {/* **Beside the lens for the same reason, and only on the two lenses that
          mark anything.** Traps and Clones are the lenses with no quantity in them:
          they put a dot on a folder's rim saying *out this way*, and on a folder
          holding hundreds those dots are a dotted line across the band. This drops
          the pointers and leaves everything they point AT exactly where it is —
          which makes it a statement about the encoding, like the cap above it, and
          not about the geometry, like the two after the spacer.

          Keyed off `viewMode` rather than `mode`, so a replay that cannot paint
          Clones does not offer a switch for marks it is not drawing. */}
      {(viewMode === 'traps' || viewMode === 'clones') && (
        <MarkerToggle on={markers} onToggle={setMarkers} />
      )}
      {/* **The third lens control, and the same rule places it.** Age measures two
          dates and has always painted one of them; this says which, so it changes
          what a colour MEANS and belongs left of the spacer with the cap and the
          marks rather than right of it with the geometry.

          On `viewMode`, so a replay that cannot paint Age does not offer a choice
          between two readings of nothing. Inside a replay it CAN: a frame carries
          both dates per drawn function and, since the fold carries a birth date per
          file too, per stand-in as well — see `Frame.pathBorn`. */}
      {viewMode === 'age' && <AgeReading read={ageRead} onRead={setAgeRead} />}
      {/* **With the lens, for the reason all four of these are.** What it changes is
          what the colour MEANS — a count, or that count measured against what is
          normal for a body this size. Not the geometry, which is what lives right of
          the spacer. */}
      {viewMode === 'tangle' && (
        <TangleReading read={tangleRead} onRead={setTangleRead} />
      )}
      {/* **The fifth lens control, and the same rule places it.** Blame paints one
          name per wedge and there are two names it could paint — who touched this
          last, or whose lines most of it IS. That is what the colour MEANS, so it
          belongs left of the spacer with the other four rather than right of it
          with the geometry.

          On `viewMode`, so a replay that cannot paint Blame does not offer a choice
          between two readings of nothing. And a frame carries neither reduction —
          `history.ts` builds its nodes with both null — so this is the one lens
          control that is genuinely absent during a replay rather than merely
          quiet. */}
      {viewMode === 'blame' && (
        <BlameReading read={blameRead} onRead={setBlameRead} />
      )}
      {/* **The fourth lens control, in the same slot and on the same rule.** What it
          changes is what a colour MEANS on this lens — whether a doc a reader judged
          derivable is painted as none or as full. Keyed off `viewMode` like the
          others, and it works in a replay: the frames carry the readings the repo
          held at each commit, `derivable` among them. */}
      {viewMode === 'docs' && <DerivableReading read={derivable} onRead={setDerivable} />}
      {/* **With the lens, because the horizon is what the colour MEANS.** Churn is a
          rate, and a rate without a window named is a number with no unit — the
          thing this bar already refuses to print. Offered even before the timeline
          has been walked: the ladder is a fact about how long the repo has existed,
          and a control that appeared only after a minute of walking would be a
          choice nobody knew they had. */}
      {viewMode === 'churn' && (
        <ChurnWindow
          windows={lensViews.churn.windows}
          at={lensViews.churn.at}
          onPick={setChurnAt}
        />
      )}

      <Spacer />

      {/* **In the room the lens strip gave up.** These went to the crumb bar when
          eleven tabs owned this row — see `ModeSwitcher`, which is one pulldown
          now. They belong here: the lens says what the map is COLOURED by, and
          these say how much of it is DRAWN, which is a statement about the same
          picture from the other side. The crumb bar is about where you are standing
          in it. Both stay live during a replay, because a frame is drawn by the
          same layout and they mean there exactly what they mean anywhere else —
          which is not true of the lens beside them. */}
      <RingCount rings={rings} onRings={chooseRings} />
      {/* **The band width and the spacing menu were here and are settled.** Both had
          arguments behind their defaults and both were looked at on real repos until
          those arguments stopped moving; a control that everyone leaves alone is a
          control that costs the bar its room and every reader a decision they have
          no basis to make. The values live on as constants — see `BAND_SHARE` and
          `SPACING_DEFAULT`, which still carry the reasoning.

          The ring count stays because its consequence is visible immediately and in
          the picture, which is the test the reader batch size failed. */}

      <Spacer />

      {/* The two doors. History replaces the subject — the repo as it stood rather
          than as it stands — and Find gets you somewhere inside the subject you
          already have. Both leave the picture you were looking at, which is what
          puts them together and after everything that shapes it. */}
      <HistoryToggle
        on={historyOn}
        busy={historyBusy}
        traced={(activeProject?.replayed ?? 0) > 0}
        onToggle={toggleHistory}
      />
      <FindButton
        on={finding}
        disabled={findingsOpen || helping}
        onOpen={() => setFinding(true)}
      />
    </div>
  )
}

/** The growing gap between groups of controls in the top row.
 *
 *  **The bar is three groups pinned to three places, not eight peers in a huddle.** What the
 *  color means goes hard left, what is ON the map floats in the middle, and the two doors out
 *  of the picture go hard right — so each group has a fixed address and the eye learns where
 *  to reach rather than reading the row every time. A hairline was the first version and it
 *  separated the groups without placing them; the width the row already had was doing nothing.
 *
 *  **It carries the drag region, which is the whole reason this is a component.** `TopRow` is
 *  a Tauri drag handle and Tauri drags only when the EVENT TARGET carries the attribute — so
 *  a full-width child takes the entire titlebar out of the window's grip unless it carries the
 *  attribute too, which the toolbar's own wrapper now does. These spacers are the elastic
 *  chrome between the controls and the widest handle on the row, which is why they hold it
 *  explicitly rather than inheriting the wrapper's. */
function Spacer() {
  // **`self-stretch`, or it is a hit area with no height.** An empty span in an
  // `items-center` row is as tall as nothing at all, so the attribute was on an element that
  // occupied a sliver across the middle of the strip: the drag worked, on a few pixels,
  // which reads exactly like it not working. Stretching it to the row makes the elastic gap
  // the full-height handle it looks like.
  return <span data-tauri-drag-region aria-hidden className="min-w-4 flex-1 self-stretch" />
}

/**
 * The finder, as a button.
 *
 * **⌘F is the real control and this is the one that says so.** A shortcut nobody can see is
 * a feature only its author has; the button exists so the panel is discoverable by looking,
 * and it names the key in its tooltip so the second visit is faster than the first. That is
 * the whole job — it opens exactly what the key opens, and there is deliberately no field
 * parked in the bar. A search box on the chrome is a control you have to look at forever to
 * use twice a day, and this row is the one the lens strip had to be dismantled to make room
 * in (see `ModeSwitcher`).
 *
 * A drawn magnifier rather than a glyph from the font, for the reason the switcher's caret
 * gives: at this size a system glyph is the same shape and depends on what is installed.
 *
 * Lit while the panel is up, so the button and the panel are visibly one thing rather than
 * two ways in.
 */
function FindButton({
  on,
  disabled,
  onOpen,
}: {
  on: boolean
  /** Another panel is up over the map. **The shortcut is refused in the same state** — see
   *  `Where.covered`: a control dead here and live on the keyboard is not disabled. */
  disabled: boolean
  onOpen: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      aria-label="Find"
      title={disabled ? 'Close the panel to search' : 'Find a function, file or directory  (⌘F)'}
      className={`flex items-center rounded-full px-2 transition-colors ${CONTROL_H}`}
      style={{
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
        opacity: disabled ? 0.4 : undefined,
        cursor: disabled ? 'default' : undefined,
      }}
    >
      {/* **Sized to the pills' LINE BOX, not to their type.** An 11px icon read as a smaller
          BUTTON rather than as a smaller glyph, because what the pills beside this one are as
          tall as is the box 11px of type sits in — about 16, not 11. That is now declared
          rather than inferred (see `CONTROL_H`, which is why the padding here is gone), but the
          glyph still has to match the type it stands in for, and 16 is about right optically:
          an icon has to be a little larger than cap height to carry a word's weight.

          Stroked rather than filled, so it holds its shape at this size and inherits the
          same `currentColor` flip the other pills use when they light up. */}
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="6.6" cy="6.6" r="4.4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M9.9 9.9 L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  )
}

function HistoryToggle({
  on,
  busy,
  traced,
  onToggle,
}: {
  on: boolean
  busy: boolean
  /** Is there a trace to look at? Commits already walked and banked for this repo.
   *
   *  **This control opens a view and must never commission the work behind it.** It did
   *  both: pressing History on an untraced repo started the walk, disabled the whole nav
   *  bar and left somebody watching a button say `Reading…` for an hour. The work is asked
   *  for on the project's own row, where the number of commits it will cost is written next
   *  to the button. Here, a repo nobody has traced simply has nothing to show. */
  traced: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      // **Leaving is always allowed.** Disabling this while a trace runs locked somebody
      // into a view of a story that was still being written — the map empty, the transport
      // pointed at frames that did not exist yet, and the way out greyed. Going back to the
      // repo as it stands costs nothing and cannot fail; it is only ENTERING that needs
      // something to show.
      disabled={!on && (busy || !traced)}
      title={
        on
          ? 'Back to the repo as it stands now  (⌘+)'
          : busy
            ? 'Tracing this repo — the project row has the progress and a way to stop'
            : !traced
              ? 'No trace yet. Press Trace on the project to walk its commits.'
              : 'The repo commit by commit — colored by arrivals, not by predictability  (⌘+)'
      }
      className={`flex items-center gap-1 rounded-full px-2.5 text-[11px] transition-colors ${CONTROL_H}`}
      style={{
        background: on ? 'var(--accent)' : 'color-mix(in oklch, var(--foreground) 8%, transparent)',
        color: on ? 'var(--accent-foreground)' : 'var(--muted-foreground)',
        fontWeight: on ? 600 : 400,
        opacity: !on && (busy || !traced) ? 0.6 : 1,
        boxShadow: on ? '0 1px 2px rgb(0 0 0 / 0.25)' : undefined,
      }}
    >
      {/* The same padlock the lens tabs wear, keyed the same way: Trace opens this one, so
          it takes the accent rather than the muted ink. A repo mid-trace is not locked — it
          is busy, which the label already says. */}
      {!on && !busy && !traced && <Lock keyed />}
      {busy ? 'Tracing…' : 'History'}
    </button>
  )
}
