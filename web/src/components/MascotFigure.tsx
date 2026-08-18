import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Mascot,
  randomizeMascot,
  type MascotAnimation,
  type MascotConfig,
  type MascotExtent,
  type MascotHandle,
} from '../lib/mascot'
import type { AgentCall } from '../lib/api'
import { saveMonster, storedMonster } from '../lib/monster'

function loadOrMint(project: string | null | undefined): MascotConfig {
  const saved = storedMonster(project)
  if (saved) return saved as MascotConfig
  // The one place a creature is born — from the first look at a project, and from a
  // `forgetMonster` in the sidebar's menu, which is the same path deliberately. Minting
  // needs the bundle, which is why it happens here and not beside the storage.
  const fresh = randomizeMascot()
  saveMonster(project, fresh)
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

/** What the creature is doing.
 *
 *  **A boolean could not express stopping.** `active` meant "something is happening", so a
 *  run being torn down looked identical to one working — the mascot went on playing the
 *  moods of whatever calls the dying readers still made.
 *
 *  **`sleeping` no longer puts it to sleep.** It did, and that was the panel's doing: a word
 *  sat beside the creature reading SLEEPING, so the picture had to match the label or the
 *  two contradicted each other. The word is gone with the panel, and what is left is a
 *  creature in the middle of the map with its own idle ladder — active, bored, sleepy,
 *  asleep — which the bundle runs on its own clock and which is better company than a thing
 *  that snaps into a coma the moment a wave ends. So this rung means only "nothing to play",
 *  and the library decides what a lull looks like. Nothing here calls `sleep` or `wake`:
 *  `play` wakes the creature itself when a reading lands. */
export type MascotState = 'sleeping' | 'working' | 'stopping'

/** Confusion, for a run being taken apart. Repeated on a beat rather than played once: the
 *  readers take seconds to die and a single shrug at the start of that would leave the
 *  creature standing about looking fine while the label still says Stopping. */
const CONFUSED: MascotAnimation[] = ['shrug', 'brainless', 'headTilt', 'lookAround']
const CONFUSED_EVERY_MS = 1400

/** Between animations in a replayed burst. Long enough that two reads as two, short
 *  enough that a full poll interval's backlog clears before the next one arrives. */
const BEAT_MS = 520

/** Of a backlog, how much is worth watching. Beyond this the burst stops being legible as
 *  a sequence and becomes a twitch, and the oldest calls are the least interesting. */
const MAX_REPLAY = 4

/** How often a mouse that is moving is allowed to poke the creature, in ms.
 *
 *  Moving the pointer anywhere in the window wakes it — the map is the thing people are
 *  using and the creature lives in the middle of it, so a person working the sunburst is
 *  company. `wake` only resets the idle clock, so calling it on every one of the hundreds of
 *  mousemove events a second would be free and pointless; a couple of times a second is well
 *  inside the bundle's own bored/sleepy thresholds. */
const WAKE_EVERY_MS = 400

/** After this long without a mouse, the next movement gets an animation and not just a
 *  reset clock — see `STIRRED`.
 *
 *  **`wake` alone does not wake it, and that is not a bug in the bundle.** It clears the idle
 *  state and the sleep flags; what it does not do is reopen the eyes, because the eyelids are
 *  the animation's business and there is no animation running. So a creature poked only by
 *  `wake` sits there with its eyes shut looking exactly as asleep as it did before — which is
 *  what "I am clicking around and it is still asleep" looks like. `play` is the path that
 *  handles a sleeping creature properly: it starts the wake animation and queues what you
 *  asked for behind it.
 *
 *  Which is why this is a GAP and not every movement. Playing something on every stir would
 *  be a creature that twitches whenever the pointer crosses the window, and the bundle's own
 *  idle ladder — bored, sleepy, asleep — is the thing worth preserving in a window nobody is
 *  at. This only fires when somebody has actually been away. */
const STIR_AFTER_MS = 8000

/** What a creature does when somebody comes back. Small, and none of them are the flourishes
 *  a reading earns: noticing you is not news about the repo. */
const STIRRED: MascotAnimation[] = ['lookAround', 'headTilt', 'wiggle', 'stretch']


/** How often the gaze is re-pushed at the creature while there is something to watch.
 *
 *  Not an animation rate — the engine pursues the point smoothly on its own, so this only
 *  has to be often enough to beat the bundle's `mousemove` handler, which writes the same
 *  target and never checks whether a focus is set. It also covers the scene not existing
 *  yet on the first direction. Cheap: two method calls, and only while a scan or a replay
 *  is actually moving. */
const AIM_MS = 100

/** How long the creature looks at one flashing wedge before moving to the next.
 *
 *  Long enough to read as attention rather than a twitch, short enough that a lull with
 *  three files in it still looks like something is happening. */
const DWELL_MS = 900

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
  gaze,
  project,
  remint,
}: {
  size?: number
  /** The last few agent calls, oldest first, as the backend saw them. */
  events?: AgentCall[]
  /** Sleeping, working, or being torn down — see [`MascotState`]. */
  state?: MascotState
  /** Unit directions to watch, in the creature's own world — x right, **y up** — or null to
   *  hand the eyes back to the bundle's own wandering. More than one is looked at in turn;
   *  see `gaze` in `Sunburst`, which aims these at whatever is flashing. */
  gaze?: Array<{ x: number; y: number }> | null
  /** Which repo this creature belongs to. Its blueprint is stored per project — see
   *  `loadOrMint`. */
  project?: string | null
  /** Bumped when the sidebar mints a new one for this project, which is the only thing that
   *  can change a blueprint that is otherwise kept forever. A counter rather than the config
   *  itself: the blueprint lives in storage, and passing it down would make two owners of
   *  one fact. */
  remint?: number
}) {
  const [config, setConfig] = useState<MascotConfig>(() => loadOrMint(project))
  // A different project is a different creature, and a remint is a new one for this project.
  const shown = useRef<string>(`${project ?? ''}:${remint ?? 0}`)
  const want = `${project ?? ''}:${remint ?? 0}`
  if (shown.current !== want) {
    shown.current = want
    setConfig(loadOrMint(project))
  }
  const handle = useRef<MascotHandle>(null)
  /** How far this creature has to be lifted to look centred — see `onReady`.
   *
   *  **Null means "the bundle has not said yet", and it lasts a frame rather than a second.**
   *  It used to mean "not measured yet" and hid the creature for as long as the measurement
   *  took, because the alternative was drawing it on the floor and then jumping it into
   *  place — and a jump is worse than a wait. The extent now arrives with `ready`, before
   *  anything is drawn, so there is no window to hide: what the hiding was costing was the
   *  intro animation, which nobody had ever seen. */
  const [lift, setLift] = useState<number | null>(null)
  /** Highest call sequence already animated. Starts at zero rather than at the first
   *  batch's head on purpose — opening the window mid-run should replay the tail, which
   *  is the only way the indicator says anything about a session already in progress. */
  const seen = useRef(0)

  /** Whether this instance is still on screen, so a measurement that resolves after a remint
   *  or an unmount is dropped rather than written to a creature that has gone. */
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  // The offset is in pixels of the box it is drawn into, so it is per blueprint AND per
  // size: a remint is a different creature standing at a different height.
  /** Where the creature rests in its canvas, once the bundle says.
   *
   *  **Handed over, not measured.** This used to snapshot the canvas and scan the alpha for
   *  the topmost and bottommost opaque row — and its own doc said the reason it could be
   *  done once was that the creature "does not move". It moves constantly: an idle bob and
   *  breath run the whole time, the intro plays over the first frames, and any mood can
   *  throw a limb past the resting outline. So it was one sample of an oscillating signal,
   *  kept forever, and every so often it caught a hop and stood the creature too high for
   *  the rest of the session.
   *
   *  The library reports its resting silhouette now (`restExtent`, added upstream), which is
   *  a property of the blueprint rather than of the instant it was asked. Two things fall
   *  out: the answer is right every time, and it is available before the first frame — so
   *  there is nothing to hide while it is worked out, and the intro animation is finally
   *  visible instead of being covered by the thing that was measuring it.
   *
   *  Stable, because the bundle rebuilds the whole creature whenever this identity changes —
   *  an inline arrow here is a scene disposed and built again on every render of the app. */
  const onReady = useCallback(
    (_renderer: unknown, extent: MascotExtent | null) => {
      if (!mounted.current) return
      // Absent is a real answer: a bundle that cannot say — the committed placeholder — gets
      // the creature standing on the floor of its box, which is where it stood before any of
      // this existed.
      setLift(extent ? Math.round((0.5 - (extent.top + extent.bottom) / 2) * size) : 0)
    },
    [size],
  )

  /**
   * Watch what the map is doing.
   *
   * **`renderer.shared.engine`, and getting that address wrong is silent.** The React handle
   * forwards `play`, `wake` and `snapshot` and exposes the renderer as a getter; the gaze is
   * three levels down, on the part animator. Written against `renderer` directly — which is
   * where it looks like it should be, since `play` and `wake` are forwarded from there — it
   * type-checks, the `typeof` guard finds nothing, and the eyes go on tracking the mouse
   * with nothing on screen saying why. That is the `captureImage` trap above, repeated
   * exactly, and the guards that make a missing method survivable are the same guards that
   * make a wrong address invisible. Both calls stay guarded, because the committed
   * placeholder bundle has none of this and must not throw — but the address was verified by
   * reading the bundle rather than assumed.
   *
   * The bundle pursues the point smoothly, so nothing here animates: this fires when the lit
   * set moves the direction enough to matter (`Sunburst` rounds it), and the eyes glide.
   * Clearing hands the gaze back to mouse tracking and the random glance-aways.
   */
  useEffect(() => {
    const at = gaze ?? []
    const aim = () => {
      const shared = handle.current?.renderer?.shared
      const engine = shared?.engine
      // The scene is built in an effect of the bundle's own, so on the first direction there
      // is nothing here yet. Nothing to do but try again on the next tick.
      if (!engine || !shared) return
      if (at.length === 0) {
        if (typeof engine.clearGazeFocus === 'function') engine.clearGazeFocus()
        return
      }
      // **One at a time, on a dwell.** Several things are flashing at once and the work does
      // not move at a constant rate — blame arrives in bursts and then labours over three or
      // four files for seconds — so a single averaged bearing parks the eyes for the whole
      // lull and reads as a creature staring at nothing. Looked at in turn it reads as one
      // watching, which is what it is doing. Driven off the clock rather than a counter so
      // the rhythm does not depend on how often this effect happens to be rebuilt.
      const d = at[Math.floor(Date.now() / DWELL_MS) % at.length]
      // **Both, and repeatedly.** `setGazeFocus` is what stops the creature wandering off
      // and glancing around; `setMouseWorld` is what actually moves the pupils, because in
      // focus mode the engine reads the target that function computes and focus itself never
      // writes it. Pushed on a timer rather than set once for two reasons that both bite:
      // the aim has to survive the bundle's own `mousemove` handler, which calls
      // `setMouseWorld` and does not check whether focus is on; and a direction that holds
      // still while the scan works one part of the ring would otherwise be applied once,
      // before the scene existed, and never again.
      if (typeof engine.setGazeFocus === 'function') engine.setGazeFocus(d.x, d.y)
      // Far enough out that the engine's own falloff saturates and only the direction is
      // left — it scales the pupil offset by `min(distance / 120, 1)`, so anything well past
      // the creature aims the same and nothing depends on the size it was drawn at.
      if (typeof shared.setMouseWorld === 'function') shared.setMouseWorld(d.x * 400, d.y * 400)
    }
    aim()
    const id = window.setInterval(aim, AIM_MS)
    return () => window.clearInterval(id)
    // The directions themselves, flattened: a fresh array of the same bearings must not
    // restart the dwell, or a lit set that is merely re-published every quarter second
    // would keep resetting the glance to its first target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(gaze ?? []).map((d) => `${d.x},${d.y}`).join(';')])


  // **Moving the mouse anywhere in the window wakes it.** The bundle sleeps on its own idle
  // clock, which is the right behaviour for a window nobody is at — and the wrong one for a
  // person working the map the creature is sitting in the middle of. Whole window rather
  // than the canvas: a creature that only stirs when you point directly at it is a hover
  // effect, and what this is trying to say is "somebody is here".
  //
  // Clicks count as well as movement: somebody working a trackpad without moving the pointer
  // is as present as somebody sweeping it across the map.
  useEffect(() => {
    let last = 0
    const stir = () => {
      const now = performance.now()
      const away = now - last
      if (away < WAKE_EVERY_MS) return
      last = now
      // Back after a while — say hello, which is also what actually opens the eyes. Never
      // over a run being torn down: that has its own loop and its own thing to say.
      if (away > STIR_AFTER_MS && state !== 'stopping') handle.current?.play(pick(STIRRED))
      else handle.current?.wake()
    }
    window.addEventListener('mousemove', stir, { passive: true })
    window.addEventListener('mousedown', stir, { passive: true })
    return () => {
      window.removeEventListener('mousemove', stir)
      window.removeEventListener('mousedown', stir)
    }
  }, [config, state])

  // Come apart while a run is being stopped, and otherwise leave the creature alone.
  //
  // Driven by the STATE rather than by events: a stopping run still produces MCP chatter —
  // the dying readers' last calls — and animating that chatter is how the creature came to
  // look busy while its run was being killed.
  //
  // The quiet rung does nothing at all. It used to play `sleep` and hold it there, which was
  // a picture matched to a word that no longer exists; the bundle has its own idle ladder and
  // reaches sleep on its own clock, having been bored first.
  useEffect(() => {
    if (state !== 'stopping') return
    let confusing: number | undefined
    // Deferred a frame: play() before the scene mounts is silently dropped.
    const id = requestAnimationFrame(() => {
      const fluster = () => handle.current?.play(pick(CONFUSED))
      fluster()
      confusing = window.setInterval(fluster, CONFUSED_EVERY_MS)
    })
    return () => {
      cancelAnimationFrame(id)
      window.clearInterval(confusing)
    }
    // `config` too: a remint REMOUNTS the scene, so a run being stopped while somebody is
    // minting a new creature keeps its fluster on the creature that arrives.
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
      // No `wake` first: the bundle's own `play` wakes a sleeping creature and queues the
      // animation behind it, so a reading landing after a quiet hour still shows up — and
      // waking it by hand is exactly the lifecycle control that was taken out.
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

  // **A creature is not a control.** Getting another one is a named item in the project's
  // own menu now, where it can say what it does — it used to be six clicks on the creature
  // itself, a gesture with nothing on screen to discover it by and nothing to explain it,
  // sitting on a decoration in a panel with a real button beside it.
  return (
    <span className="contents">
      {/* Keyed on the blueprint, so a new one REMOUNTS rather than re-rendering. The scene
          builds its parts when it mounts and the handle is imperative — feeding a fresh
          config to the same instance leaves the old creature on screen, which reads as six
          clicks doing nothing. */}
      {/* Stood on its box. Negative is up, and it is nearly always negative: the ground
          plane is at the bottom of the frame, so a creature shorter than the frame sits
          below the middle of it. Applied to the canvas rather than to the layout, so
          nothing around it moves when a remint changes the number.

          Invisible until the box is known, and NOT unmounted: the scene has to be built and
          drawn before there is anything to measure, so a creature that waits for its offset
          before rendering waits forever. It draws, it is measured off its own first frame,
          and it is revealed already standing where it belongs.

          No fade. A transition here is the same jump wearing a longer coat, and the arrival
          is already soft — the creature is doing something within the second. */}
      <Mascot
        key={JSON.stringify(config)}
        ref={handle}
        config={config}
        size={size}
        onReady={onReady}
        style={{
          transform: `translateY(${lift ?? 0}px)`,
          visibility: lift === null ? 'hidden' : 'visible',
        }}
      />
    </span>
  )
}
