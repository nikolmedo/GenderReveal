import { NextResponse } from 'next/server'
import { isRevealed } from '@/lib/config'
import { castVote, cleanChoice, cleanName, cleanVoterId, tally } from '@/lib/votes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (isRevealed()) {
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

  await castVote(voterId, name, choice)

  return NextResponse.json(
    { ok: true, counts: await tally() },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
