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

/** Between animations in a replayed burst. Long enough that two reads as two, short
 *  enough that a full poll interval's backlog clears before the next one arrives. */
const BEAT_MS = 520

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
  active = true,
}: {
  size?: number
  /** The last few agent calls, oldest first, as the backend saw them. */
  events?: AgentCall[]
  /** False when no agent has called recently — the mascot dozes off. */
  active?: boolean
}) {
  const [config] = useState<MascotConfig>(() => loadOrMint())
  const handle = useRef<MascotHandle>(null)
  const asleep = useRef(false)
  /** Highest call sequence already animated. Starts at zero rather than at the first
   *  batch's head on purpose — opening the window mid-run should replay the tail, which
   *  is the only way the indicator says anything about a session already in progress. */
  const seen = useRef(0)

  // Doze off when the scan ends and wake when one starts. The indicator is permanent, so
  // a creature that idles identically whether or not work is happening would make the
  // corner of the window meaningless.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!handle.current) return
      if (active && asleep.current) {
        asleep.current = false
        handle.current.wake()
      } else if (!active && !asleep.current) {
        asleep.current = true
        handle.current.play('sleep')
      }
    })
    return () => cancelAnimationFrame(id)
  }, [active])

  // Play whatever happened since the last poll, in order.
  //
  // Keyed on sequence numbers rather than on a render count: the window polls every two
  // seconds and a working reader calls faster than that, so an effect that fired once per
  // poll would animate one call out of every three or four and always the last one — the
  // instrument would show `status` while the interesting reports went past unseen.
  //
  // Deferred a frame: play() before the scene mounts is silently dropped.
  useEffect(() => {
    if (!active) return
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
  }, [events, active])

  return <Mascot ref={handle} config={config} size={size} />
}
