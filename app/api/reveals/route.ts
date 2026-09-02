import { NextResponse } from 'next/server'
import { createReveal } from '@/lib/reveals'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BODY_BYTES = 16_000

export async function POST(request: Request) {
  const raw = await request.text()

  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 413 })
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const result = await createReveal(body)

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'collision' ? 500 : 400 })
  }

  return NextResponse.json(
    {
      hash: result.hash,
      path: `/r/${result.hash}`,
      // The organiser's own way back in. Handed over once, never listed
      // anywhere, and impossible to derive from the public link.
      adminPath: `/a/${result.adminHash}`,
      revealAt: result.revealAt,
      expiresAt: result.expiresAt,
    },
    { status: 201, headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}
