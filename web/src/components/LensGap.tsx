import { MODE_LABEL, replayNote, type ColorMode } from '../lib/colorMode'

/**
 * What a lens has to say when it has no colours to show.
 *
 * **Three absences grew up separately and read as one broken thing.** A lens nobody has
 * paid for yet (Surprise before a pass) drew grey wedges and said nothing. A lens this repo
 * cannot answer (Callers where the language's calls are not wired, Age with no git) drew the
 * same grey. History was disabled outright, which is a third rendering of "not now" — and
 * the one that looks most like a bug, because a control that refuses to be pressed is
 * indistinguishable from one that is broken.
 *
 * They are two things, not three:
 *
 * - **An action would fill this.** Then say how big the action is and put it here, next to
 *   the absence, rather than leaving the user to connect a grey ring to a button in another
 *   panel.
 * - **Nothing will fill this here.** Then say why, and offer nothing — a button that cannot
 *   help is worse than no button.
 *
 * Rendered over the map rather than instead of it. The rings, their sizes and their names
 * are real and already drawn; what is missing is a colour, and replacing the whole picture
 * with a message would throw away the part that does work.
 */
export function LensGap({
  mode,
  kind,
  functions,
  onRead,
}: {
  mode: ColorMode
  /** Which absence. `unread` is the only one with something to press. */
  kind: 'unread' | 'nogit' | 'unwired' | 'replay'
  /** Functions with no reading — the size of the job, and the number the estimate is off. */
  functions?: number
  onRead?: () => void
}) {
  const line = sentence(mode, kind, functions)
  if (!line) return null
  return (
    // Top centre: the corners are taken (crumbs, Up, the caveat chip, the legend) and the
    // top of a circle in a rectangle is dead space the picture never uses.
    <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 justify-center">
      <div
        className="pointer-events-auto flex max-w-[560px] items-center gap-3 rounded-lg px-3 py-2"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          boxShadow: '0 2px 8px color-mix(in oklch, var(--foreground) 10%, transparent)',
        }}
      >
        <p className="text-[11px] leading-snug text-[var(--muted-foreground)]">{line}</p>
        {kind === 'unread' && onRead && (
          // The control belongs where the absence is felt. The project row has it too, and
          // that is the row a user has to already understand; this is the one they are
          // looking at because it is empty.
          <button
            type="button"
            onClick={onRead}
            className="shrink-0 rounded px-2 py-[3px] text-[11px] font-semibold leading-none"
            style={{ background: 'var(--accent)', color: 'var(--accent-foreground)' }}
          >
            Read
          </button>
        )}
      </div>
    </div>
  )
}

/** One sentence per absence, naming the lens and what would change it.
 *
 *  The token estimate is the measured cost of a pass — about 23,000 to enter a reader and
 *  3,000 a function, ten functions to a reader — rounded hard, because a figure with three
 *  significant digits in it would be read as a quote rather than as an order of magnitude.
 */
function sentence(mode: ColorMode, kind: string, functions?: number): string | null {
  const name = MODE_LABEL[mode]
  switch (kind) {
    case 'unread': {
      const n = functions ?? 0
      const cost = n > 0 ? ` — ${n.toLocaleString()} to read, roughly ${tokens(n)}` : ''
      return `${name} is painted by readings, and this repo has none yet${cost}. Age, Churn, Blame, Language, Callers, Reach and Clones work now.`
    }
    case 'nogit':
      return `${name} reads git, and this folder has no history. Nothing to fix — the other lenses are unaffected.`
    case 'unwired':
      return `${name} needs this language's calls read off its grammar, which Sanity does not do for it. A missing edge would be worse than a stated absence.`
    case 'replay':
      return replayNote(mode)
    default:
      return null
  }
}

/** A pass, in tokens, at one significant figure. */
function tokens(functions: number): string {
  const total = functions * 5_300
  if (total >= 1_000_000) return `${Math.round(total / 100_000) / 10}M tokens`
  return `${Math.round(total / 1_000)}k tokens`
}
