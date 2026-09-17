import type { Node, FindingGroup, RepoHead } from '../api'
import type { Bucket, ColorMode, Views } from '../colorMode'
import type { Locked } from '../locks'
import type { Vars } from '../vector/color'
import type { Deflate } from '../vector/doc'
import type { Face } from '../vector/fonts'
import type { FontSet } from '../vector/surface'

/**
 * The three shapes the analysis is exported in.
 *
 * - **Report**, the paper: methodology, contents, every essay whole with its tables, and every
 *   group of findings on its own map.
 * - **Brief**: a cover, one page per lens holding its map and two sections of its essay
 *   (`SHORT_SECTIONS`), and the findings on one map with the grid of what raised them.
 * - **Deck**: the lenses, as 16:9 slides — a title slide, one slide per lens with the map beside
 *   its words, and one slide for the findings. It presents what the lenses are and what they say
 *   here; the findings themselves are a document to read, not a wall to stand in front of.
 */
export type Form = 'report' | 'brief' | 'deck'

export const FORM: Record<Form, { label: string; noun: string }> = {
  report: { label: 'Report', noun: 'report' },
  brief: { label: 'Brief', noun: 'brief' },
  deck: { label: 'Deck', noun: 'deck' },
}

export interface ReportTick {
  /** Pages finished. */
  done: number
  /** Pages there will be, once known; 0 before the report is laid out. */
  total: number
  /** What is being drawn, in the words the dialog prints. */
  what: string
}

/** The numbers the methodology states about this repository. */
export interface ReportStats {
  /** Lines of function bodies — the map's own width. */
  lines: number
  functions: number
  files: number
  /** Current readings, stale excluded — `ProjectSummary::assessed`. */
  assessed: number
  stale: number
  /** Files no parser could read, or null where the backend did not say. */
  unparsed: number | null
  /** Languages present, largest first. */
  languages: string[]
  /** Grammars in this build, or null before the list arrived. */
  grammars: number | null
  /** The model every banked reading agrees on, or null. */
  model: string | null
  harness: string | null
  /** Readings per model, which says whether the corpus is on one scale. */
  models: { model: string; readings: number }[]
  /** Complexity's median count per size band (`TANGLE_EDGES`), null where a band is empty. */
  tangleBands: (number | null)[]
  /** Call sites that reached a definition here and ones that did not — null from an older scan. */
  callsResolved: number | null
  callsUnresolved: number | null
  commits: number
  /** People who have committed, as ranked — capped at what the palette holds. */
  authors: number
  /** The churn windows this repo offers, in days. */
  churnWindows: number[]
  /** Days since the oldest surviving line — Age's span — or null with no tree. */
  ageSpan: number | null
}

/** One band of a lens over the whole repo, as the panel's breakdown lists it — with its function
 *  nodes, which the examples tables rank. */
export type ReportBucket = Bucket

/** One figure's map, as the map component renders it without a window. */
export interface MapRender {
  markup: string
  viewBox: [number, number, number, number]
  /** Every tagged wedge's drawn geometry, by node id: the path and its arc (radians, user units). */
  spots: Map<string, { d: string; a0: number; a1: number; r0: number; r1: number }>
}

/** A figure a report asks for: a lens, the density it is laid out at, and the root it is of. */
export interface MapRequest {
  mode: ColorMode
  /** Layout pixels across — see `U`. */
  px: number
  /** A node id, or `''` for the whole repository. */
  root: string
}

/** What a vector page is written with, which differs between the window and a script. */
export interface VectorEnv {
  fonts: FontSet
  /** The stylesheet's custom properties, which every `var(--…)` resolves through. */
  vars: Vars
  subset: (face: Face) => Uint8Array
  deflate: Deflate
}

export interface Report {
  /** The repo as the world knows it — `owner/name` where there is a remote. */
  slug: string
  /** The commit the working tree is at, or null where git would not say. */
  head: RepoHead | null
  /** Which of the three shapes to write — see `Form`. */
  form: Form
  /** Why each lens that cannot paint is locked — `locksFor`. */
  locks: Partial<Record<ColorMode, Locked>>
  /** How the lenses are set — each page says which reading its figure is. */
  views: Views
  /** Which lens the findings maps are drawn in — one with nothing to say there; see `reportLenses`. */
  findingsLens: ColorMode
  /** The lens a deck's title slide draws the whole repository in and names. */
  heroLens: ColorMode
  groups: FindingGroup[]
  /** The tree with every function in it, readings folded in. **Every count and name in a report is
   *  read off this**, never off what a window happened to have drawn: a report and then a brief of
   *  one commit, twelve seconds apart, once named different most-complex functions. */
  tree: Node | null
  /** Category → color slot for a lens over a subtree — `slotsFor`. */
  slotsFor: (mode: ColorMode, at: Node) => Map<string, number>
  stats: ReportStats
  /** A figure's markup — see `MapRender`. */
  map: (req: MapRequest) => MapRender | Promise<MapRender>
  env: VectorEnv
  cancelled: () => boolean
  onProgress: (t: ReportTick) => void
}
