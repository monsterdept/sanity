import { useEffect, useRef, useState } from 'react'
import {
  Mascot,
  randomizeMascot,
  type MascotAnimation,
  type MascotConfig,
  type MascotHandle,
} from '../lib/mascot'

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

/** What the mascot does, by what the scan is doing. Reading is curious, scoring is
 *  heads-down, finishing celebrates. Picked at random within the set so a long scan
 *  doesn't look like a looping GIF. */
const MOODS: Array<{ match: RegExp; play: MascotAnimation[] }> = [
  // Sizing up a new repo.
  { match: /open|status/, play: ['lookAround', 'headTilt', 'earFlap', 'surprise'] },
  // Reading — heads-down.
  { match: /next/, play: ['footTap', 'stretch', 'wiggle', 'nod'] },
  // Something got reported, which is the good bit.
  { match: /report/, play: ['celebrate', 'hop', 'tailWag', 'nod'] },
  { match: /^scoring/, play: ['footTap', 'stretch', 'wiggle'] },
]

const DEFAULT_PLAY: MascotAnimation[] = ['wave', 'nod', 'wiggle', 'headTilt']

function pick(from: MascotAnimation[]): MascotAnimation {
  return from[Math.floor(Math.random() * from.length)]
}

/** Isolated in its own module so the neo-mascots bundle lands in a lazy chunk — see
 *  AgentMascot. Nothing else may import this directly. */
export default function MascotFigure({
  size = 44,
  phase = '',
  nonce = 0,
  active = true,
}: {
  size?: number
  phase?: string
  nonce?: number
  /** False when no scan is running — the mascot dozes off. */
  active?: boolean
}) {
  const [config] = useState<MascotConfig>(() => loadOrMint())
  const handle = useRef<MascotHandle>(null)
  const asleep = useRef(false)

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

  // Animate on every progress tick. Keyed on `nonce`, which advances per directory, so
  // repeated ticks in the same phase still re-animate. Deferred a frame: play() before
  // the scene mounts is silently dropped.
  useEffect(() => {
    if (!active || nonce === 0) return
    const id = requestAnimationFrame(() => {
      if (asleep.current) {
        asleep.current = false
        handle.current?.wake()
      }
      const set = MOODS.find((m) => m.match.test(phase))?.play ?? DEFAULT_PLAY
      handle.current?.play(pick(set))
    })
    return () => cancelAnimationFrame(id)
  }, [nonce, phase, active])

  return <Mascot ref={handle} config={config} size={size} />
}
