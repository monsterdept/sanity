// Type definitions for the prebuilt neo-mascots bundle (mascot.js), which ships as plain
// JS with no types of its own. Refreshed by `just mascot`; this file is hand-written, so
// re-check it after a bundle update.
//
// Only declares the surface sanity actually uses — add more as it comes up. Same shape as
// tally's and fussy's, so a block lifted from one drops into another.

import type { CSSProperties, ForwardRefExoticComponent, RefAttributes } from 'react'

// The library's MascotConfig is structurally complex; treat it as opaque here and
// round-trip it unchanged.
export type MascotConfig = unknown

/** Where the creature sits inside its canvas AT REST, as fractions of the canvas height:
 *  0 is the top edge and 1 the bottom.
 *
 *  **The resting silhouette, which is the only version of this worth having.** The creature
 *  is never still — an idle bob and breath run continuously, the intro plays over the first
 *  frames, and any animation can throw a limb past the resting outline — so a host that
 *  measures a frame is sampling something that moves and gets a different answer depending
 *  on when it looked. This is computed from the parts' base transforms, so it does not. */
export interface MascotExtent {
  top: number
  bottom: number
}

export interface MascotProps {
  config: MascotConfig
  size?: number
  className?: string
  style?: CSSProperties
  /** Called once the scene has built its parts and drawn a first frame, with where the
   *  creature rests in its canvas — see `MascotExtent`. **It is a dependency of the effect
   *  that builds the scene**, so it must be stable: a fresh arrow each render disposes and
   *  rebuilds the creature on every render. */
  onReady?: (renderer: unknown, extent: MascotExtent | null) => void
}

export type MascotAnimation =
  | 'hop'
  | 'wiggle'
  | 'headTilt'
  | 'nod'
  | 'celebrate'
  | 'surprise'
  | 'sleep'
  | 'wake'
  | 'wave'
  | 'earFlap'
  | 'tailWag'
  | 'brainless'
  | 'yawn'
  | 'stretch'
  | 'lookAround'
  | 'footTap'
  | 'shrug'
  | 'explode'
  | 'puffedUp'
  | 'idle'
  | 'bored'

// **Declare only what the React handle actually forwards.** `captureImage` was declared
// here as `renderer.captureImage` and it does not exist at that address: the bundle defines
// it on the renderer underneath, and the object the handle returns forwards play, wake,
// snapshot and the animation lists and nothing else. A hand-written declaration cannot be
// checked against the bundle, so a wrong one type-checks perfectly and throws at runtime —
// which it did, silently, inside a timeout, and the only symptom was a measurement that
// never happened.
/** The part animator, three levels under the React wrapper.
 *
 * **The gaze lives here and not on the renderer, which is the `captureImage` trap again.**
 * The chain is `handle.renderer` → `.shared` → `.engine`, and a declaration that puts these
 * one level up type-checks perfectly, no-ops silently behind a `typeof` guard, and leaves
 * the eyes tracking the mouse with nothing on screen saying why. That is exactly how this
 * was written the first time. Verified by reading the bundle: the wrapper constructs the
 * renderer, which holds `shared`, which holds `engine` — and `engine` is the class that
 * declares `setGazeFocus` beside `play` and `wake`.
 *
 * Everything is optional because a hand-written declaration cannot be checked against a
 * bundle, and the committed placeholder has none of it. */
export interface MascotEngine {
  /** Lock the eyes onto a point that far off the pupil centre, in the creature's own world:
   *  x right, **y up**. Suppresses mouse tracking and the random glance-aways until
   *  cleared; call again to move the focus. */
  setGazeFocus?(dirX: number, dirY: number): void
  /** Hand the eyes back to mouse tracking and autonomous gaze. */
  clearGazeFocus?(): void
  /** Advance every animation by this many milliseconds. What the bundle's own rAF loop
   *  passes it, which is what makes driving the creature off another clock possible at all
   *  — see `mascotClock`. */
  update?(ms: number): void
}

/** The scene wrapper, between the renderer and the part animator. */
export interface MascotShared {
  readonly engine?: MascotEngine | null
  /** Point the eyes at a spot in the creature's world — x right, **y up**.
   *
   *  **This is what actually moves the pupils.** `setGazeFocus` alone does not: in focus
   *  mode the engine reads the target `setMouseWorld` computed and nothing else writes it,
   *  so focus without this suppresses the mouse and then holds whatever the mouse last
   *  said. The bundle's own `mousemove` handler calls this too, and is NOT gated on focus
   *  mode, which is the other half of why an aim has to be pushed rather than set once. */
  setMouseWorld?(x: number, y: number): void
  /** Draw one frame, now. Underscored in the bundle and used here anyway: with the render
   *  loop paused it is the only way to produce a frame, and the export needs one per frame
   *  of the FILE rather than one per frame of this machine. Guarded like everything else
   *  declared here, because a hand-written declaration cannot be checked against a bundle. */
  _renderFrame?(): void
}

/** The scene underneath the React wrapper, reached through `MascotHandle.renderer`. */
export interface MascotRenderer {
  readonly shared?: MascotShared | null
  /** Pause or resume the creature's own animation loop without disposing the WebGL context.
   *  Forwarded to `shared` by the bundle, and public there. */
  setRendering?(on: boolean): void
}

export interface MascotHandle {
  play(animation: MascotAnimation | string): void
  wake(): void
  snapshot(): string | null
  /** Where the creature rests in its canvas. Also handed to `onReady`, which is the moment
   *  a host that positions it actually needs it. */
  restExtent(): MascotExtent | null
  /** The scene itself. The wrapper forwards a handful of methods and exposes this for the
   *  rest — see [`MascotRenderer`]. */
  readonly renderer: MascotRenderer | null
  readonly animations: string[]
}

export const Mascot: ForwardRefExoticComponent<MascotProps & RefAttributes<MascotHandle>>

export interface RandomizeOptions {
  preferredBodyId?: string | null
  matchPairs?: boolean
}

export function randomizeMascot(opts?: RandomizeOptions): MascotConfig
