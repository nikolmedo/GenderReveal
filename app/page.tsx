import { RevealExperience } from '@/components/RevealExperience'
import { revealAt } from '@/lib/config'
import { countdownCopy } from '@/lib/messages'

export const dynamic = 'force-dynamic'

/**
 * Server shell. It hands the client the countdown and everything around it —
 * and deliberately nothing about the outcome, which only /api/state releases,
 * and only once the moment has actually passed.
 */
export default function Page() {
  // Handing the render clock down as a prop keeps the server's markup and the
  // client's first render byte-identical. Reading Date.now() on both sides
  // instead would put two different numbers on screen and break hydration.
  return <RevealExperience revealAt={revealAt} serverNow={Date.now()} copy={countdownCopy} />
}
