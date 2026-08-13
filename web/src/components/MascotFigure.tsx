import { useEffect, useRef, useState } from 'react'
import {
  Mascot,
  randomizeMascot,
  type MascotAnimation,
  type MascotConfig,
  type MascotHandle,
} from '../lib/mascot'
import type { AgentCall } from '../lib/api'

/** One creature per machine, minted on first run and kept, so the thing working through
 *  your repo is recognisably the same thing each time you open the app. */
const STORAGE_KEY = 'sanity.mascot'

function loadOrMint(): MascotConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as MascotConfig
  } catch {
    /* unreadable or corrupt — fall through and mint a fresh one */
  }
  const fresh = randomizeMascot()
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
  } catch {
    /* storage unavailable; this machine's mascot just won't persist */
  }
  return fresh
}

/** What the mascot does, by what an agent just called.
 *
 *  The creature is the only part of this window readable from across the room, so what it
 *  does has to track what the protocol is doing rather than merely proving the app is
 *  awake. Two rules hold the table together:
 *
 *  - Loudness follows rarity, not effort. `status` is the call a driving loop makes most
 *    often and carries the least news, so it gets the smallest set; a surprising reading
 *    and an empty queue are the two things worth looking up for, and they get the biggest.
 *  - The mascot may not claim more than the call did. `sanity_error` reads as confusion,
 *    not as work — a celebration over a report that failed to save is the same kind of lie
 *    as a term claiming confidence it hasn't got.
 *
 *  First match wins, so the qualified forms sit above the bare tool names they extend.
 *  Picked at random within a set so a long run doesn't look like a looping GIF. */
const MOODS: Array<{ match: RegExp; play: MascotAnimation[] }> = [
  // Nothing left to hand out: the end of the job, and the only flourish in the protocol.
  { match: /next:done/, play: ['celebrate', 'tailWag', 'hop'] },
  // A reading the reader was caught out by — the finding the whole instrument is for.
  { match: /report:hot/, play: ['surprise', 'puffedUp', 'hop'] },
  // Re-reading a function whose body moved. Honest work, but not news.
  { match: /report:stale/, play: ['yawn', 'shrug', 'stretch'] },
  // Confirmation: the code read the way its name implied.
  { match: /report:cold/, play: ['nod', 'wiggle'] },
  { match: /report/, play: ['nod', 'wiggle', 'tailWag'] },
  // Sizing up a repo it has not seen.
  { match: /open/, play: ['lookAround', 'headTilt', 'earFlap'] },
  // Work handed out — heads-down.
  { match: /next/, play: ['footTap', 'stretch', 'wiggle', 'nod'] },
  // Polled constantly; deliberately the quietest set in the table.
  { match: /status/, play: ['idle', 'lookAround'] },
  // Something went wrong. It must not look like progress.
  { match: /error/, play: ['shrug', 'brainless'] },
]

const DEFAULT_PLAY: MascotAnimation[] = ['wave', 'nod', 'wiggle', 'headTilt']

/** What the creature is doing, which is the panel's own state rather than a guess at it.
 *
 *  **A boolean could not express stopping.** `active` meant "something is happening", so a
 *  run being torn down looked identical to one working — the mascot went on playing the
 *  moods of whatever calls the dying readers still made. Three states, matching the three
 *  words the panel puts beside it, so the picture and the label cannot disagree. */
export type MascotState = 'sleeping' | 'working' | 'stopping'

/** Confusion, for a run being taken apart. Repeated on a beat rather than played once: the
 *  readers take seconds to die and a single shrug at the start of that would leave the
 *  creature standing about looking fine while the label still says Stopping. */
const CONFUSED: MascotAnimation[] = ['shrug', 'brainless', 'headTilt', 'lookAround']
const CONFUSED_EVERY_MS = 1400

/** Between animations in a replayed burst. Long enough that two reads as two, short
 *  enough that a full poll interval's backlog clears before the next one arrives. */
const BEAT_MS = 520

/** Clicks to mint a new creature, and how long a run of them may take.
 *
 *  **Six, and a window, because this must not be reachable by accident.** The mascot is a
 *  permanent fixture in the corner of a panel with a Read button in it, so a single click
 *  replacing the thing you have watched work through your repo for a week would be a small
 *  cruelty. Six deliberate ones is a gesture nobody performs by mistake, and the window
 *  means a stray click on Tuesday does not count towards one on Friday.
 *
 *  There is deliberately no confirmation and no undo: the blueprint is random, so the old
 *  one cannot be described to somebody in a dialog, and getting another is six more
 *  clicks. */
const REMINT_CLICKS = 6
const REMINT_WINDOW_MS = 2000

/** Of a backlog, how much is worth watching. Beyond this the burst stops being legible as
 *  a sequence and becomes a twitch, and the oldest calls are the least interesting. */
const MAX_REPLAY = 4

function pick(from: MascotAnimation[]): MascotAnimation {
  return from[Math.floor(Math.random() * from.length)]
}

function moodFor(tool: string): MascotAnimation[] {
  return MOODS.find((m) => m.match.test(tool))?.play ?? DEFAULT_PLAY
}

/** Isolated in its own module so the neo-mascots bundle lands in a lazy chunk — see
 *  AgentMascot. Nothing else may import this directly. */
export default function MascotFigure({
  size = 44,
  events = [],
  state = 'working',
}: {
  size?: number
  /** The last few agent calls, oldest first, as the backend saw them. */
  events?: AgentCall[]
  /** Sleeping, working, or being torn down — see [`MascotState`]. */
  state?: MascotState
}) {
  const [config, setConfig] = useState<MascotConfig>(() => loadOrMint())
  /** Clicks so far, and when the last one landed — see `REMINT_CLICKS`. A ref because a
   *  half-finished gesture is not state anything renders. */
  const clicks = useRef({ n: 0, at: 0 })
  const handle = useRef<MascotHandle>(null)
  const asleep = useRef(false)
  /** Highest call sequence already animated. Starts at zero rather than at the first
   *  batch's head on purpose — opening the window mid-run should replay the tail, which
   *  is the only way the indicator says anything about a session already in progress. */
  const seen = useRef(0)

  // Doze off when the work ends, wake when it starts, come apart while it is being stopped.
  // The indicator is permanent, so a creature that idles identically whatever is happening
  // would make the corner of the window meaningless.
  //
  // Driven by the STATE rather than by events, so the three pictures are guaranteed to match
  // the three words. A stopping run still produces MCP chatter — the dying readers' last
  // calls — and animating that chatter is how the creature came to look busy underneath the
  // word Stopping.
  useEffect(() => {
    let confusing: number | undefined
    const id = requestAnimationFrame(() => {
      if (!handle.current) return
      if (state === 'sleeping') {
        if (!asleep.current) {
          asleep.current = true
          handle.current.play('sleep')
        }
        return
      }
      if (asleep.current) {
        asleep.current = false
        handle.current.wake()
      }
      if (state === 'stopping') {
        const fluster = () => handle.current?.play(pick(CONFUSED))
        fluster()
        confusing = window.setInterval(fluster, CONFUSED_EVERY_MS)
      }
    })
    return () => {
      cancelAnimationFrame(id)
      window.clearInterval(confusing)
    }
    // `config` too: a remint REMOUNTS the scene, and the new one arrives awake. Without
    // this, six clicks during a quiet moment left a bright-eyed creature under the word
    // SLEEPING until the next run started.
  }, [state, config])

  // Play whatever happened since the last poll, in order.
  //
  // Keyed on sequence numbers rather than on a render count: the window polls every two
  // seconds and a working reader calls faster than that, so an effect that fired once per
  // poll would animate one call out of every three or four and always the last one — the
  // instrument would show `status` while the interesting reports went past unseen.
  //
  // Deferred a frame: play() before the scene mounts is silently dropped.
  useEffect(() => {
    // Only while working. Sleeping is self-explanatory; stopping has its own loop, and
    // letting events through would have the creature cheerfully reporting readings from
    // readers that are being killed.
    if (state !== 'working') return
    const fresh = events.filter((e) => e.seq > seen.current).slice(-MAX_REPLAY)
    if (fresh.length === 0) return
    seen.current = events[events.length - 1].seq

    const timers: number[] = []
    const id = requestAnimationFrame(() => {
      if (asleep.current) {
        asleep.current = false
        handle.current?.wake()
      }
      fresh.forEach((e, i) => {
        const play = () => handle.current?.play(pick(moodFor(e.tool)))
        if (i === 0) play()
        else timers.push(window.setTimeout(play, i * BEAT_MS))
      })
    })
    return () => {
      cancelAnimationFrame(id)
      timers.forEach(window.clearTimeout)
    }
  }, [events, state])

  /** Six clicks in quick succession mints a new creature. */
  function onClick() {
    const now = Date.now()
    const run = clicks.current
    run.n = now - run.at > REMINT_WINDOW_MS ? 1 : run.n + 1
    run.at = now
    if (run.n < REMINT_CLICKS) return
    run.n = 0
    // The new scene has never been told to doze, whatever the old one was doing.
    asleep.current = false
    const fresh = randomizeMascot()
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    } catch {
      /* storage unavailable; the new one just won't outlive the window */
    }
    setConfig(fresh)
  }

  // A span rather than a button: this is an easter egg on a decoration, and a real button
  // would put it in the tab order and announce itself to a screen reader as a control that
  // does nothing describable.
  return (
    <span onClick={onClick} className="contents">
      {/* Keyed on the blueprint, so a new one REMOUNTS rather than re-rendering. The scene
          builds its parts when it mounts and the handle is imperative — feeding a fresh
          config to the same instance leaves the old creature on screen, which reads as six
          clicks doing nothing. */}
      <Mascot key={JSON.stringify(config)} ref={handle} config={config} size={size} />
    </span>
  )
}
