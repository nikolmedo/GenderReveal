import { NextResponse } from 'next/server'
import { loadReveal } from '@/lib/reveals'
import { revealStore } from '@/lib/store'
import { cleanChoice, cleanName, cleanVoterId } from '@/lib/votes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: Promise<{ hash: string }> }) {
  const { hash } = await params
  const now = Date.now()

  const reveal = await loadReveal(hash, now)
  if (!reveal) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Gated on this reveal's own instant, not a global one: two countdowns can
  // be open at once and close hours apart.
  if (now >= reveal.revealAt) {
    return NextResponse.json({ error: 'closed' }, { status: 409 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const { voterId: rawId, name: rawName, choice: rawChoice } = (payload ?? {}) as Record<string, unknown>

  const voterId = cleanVoterId(rawId)
  const name = cleanName(rawName)
  const choice = cleanChoice(rawChoice)

  if (!voterId || !name || !choice) {
    return NextResponse.json({ error: 'invalid' }, { status: 400 })
  }

  const store = await revealStore()
  await store.cast(hash, voterId, name, choice)

  return NextResponse.json(
    { ok: true, counts: await store.tally(hash) },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
