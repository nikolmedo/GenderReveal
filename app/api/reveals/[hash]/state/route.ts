import { NextResponse } from 'next/server'
import { loadReveal, revealCopy } from '@/lib/reveals'
import { revealStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The only place a countdown gets its truth.
 *
 * `serverNow` lets every browser correct its own clock drift, so a visitor
 * whose system time is wrong still hits zero at the same instant as everyone
 * else. And the entire reveal — gender, wording, score — is simply absent from
 * the payload until the server itself says the moment has passed. That is what
 * keeps the secret out of DevTools.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  const serverNow = Date.now()

  const reveal = await loadReveal(hash, serverNow)
  if (!reveal) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const store = await revealStore()
  const revealed = serverNow >= reveal.revealAt

  const body: Record<string, unknown> = {
    serverNow,
    revealAt: reveal.revealAt,
    revealed,
    counts: await store.tally(hash),
  }

  if (revealed) {
    body.gender = reveal.gender
    body.correct = await store.countMatching(hash, reveal.gender)
    body.copy = revealCopy(reveal.config.reveal, reveal.gender)
    body.tint = reveal.palette[reveal.gender].tint
  }

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
