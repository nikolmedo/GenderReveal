import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { RevealExperience } from '@/components/RevealExperience'
import { paletteVars } from '@/lib/palette'
import { loadReveal } from '@/lib/reveals'

export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ hash: string }> }

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { hash } = await params
  const reveal = await loadReveal(hash)

  return {
    title: reveal?.config.countdown.pageTitle ?? 'Countdown',
    description: reveal?.config.countdown.welcome,
    robots: { index: false, follow: false },
  }
}

/**
 * Server shell. It hands the client the countdown, its palette and the render
 * clock — and deliberately nothing about the outcome, which only
 * /api/reveals/[hash]/state releases, and only once the moment has passed.
 */
export default async function RevealPage({ params }: Params) {
  const { hash } = await params
  const reveal = await loadReveal(hash)

  if (!reveal) notFound()

  return (
    <RevealExperience
      hash={reveal.hash}
      revealAt={reveal.revealAt}
      // Handing the render clock down as a prop keeps the server's markup and
      // the client's first render byte-identical.
      serverNow={Date.now()}
      copy={reveal.config.countdown}
      palette={paletteVars(reveal.palette)}
    />
  )
}
