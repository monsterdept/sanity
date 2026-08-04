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
