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

export interface MascotProps {
  config: MascotConfig
  size?: number
  className?: string
  style?: CSSProperties
  /** Called once the scene has built its parts and drawn a first frame — which is the
   *  earliest moment a snapshot means anything. **It is a dependency of the effect that
   *  builds the scene**, so it must be stable: a fresh arrow each render disposes and
   *  rebuilds the creature on every render. */
  onReady?: (renderer: unknown) => void
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
export interface MascotHandle {
  play(animation: MascotAnimation | string): void
  wake(): void
  snapshot(): string | null
  readonly animations: string[]
}

export const Mascot: ForwardRefExoticComponent<MascotProps & RefAttributes<MascotHandle>>

export interface RandomizeOptions {
  preferredBodyId?: string | null
  matchPairs?: boolean
}

export function randomizeMascot(opts?: RandomizeOptions): MascotConfig
