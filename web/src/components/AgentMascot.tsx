import { Suspense, lazy } from 'react'
import type { AgentCall } from '../lib/api'

/** The neo-mascots bundle plus three.js is ~1.2MB — larger than the rest of the app put
 *  together — and it's only needed while a scan is actually running. Loading it lazily
 *  keeps it in its own chunk, fetched the first time the indicator appears rather than at
 *  startup. The split only holds if nothing imports MascotFigure eagerly. */
const MascotFigure = lazy(() => import('./MascotFigure'))

/** Renders a placeholder until the chunk arrives: the progress text carries the message
 *  on its own, and reserving the box keeps the row from reflowing. */
export function AgentMascot({
  size = 44,
  events,
  active,
}: {
  size?: number
  events: AgentCall[]
  active: boolean
}) {
  return (
    <Suspense
      fallback={<span style={{ width: size, height: size }} className="shrink-0" aria-hidden />}
    >
      <MascotFigure size={size} events={events} active={active} />
    </Suspense>
  )
}
