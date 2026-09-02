import { NextResponse } from 'next/server'
import { loadRevealByAdmin, updateReveal } from '@/lib/reveals'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BODY_BYTES = 16_000

/** What the organiser's panel needs to fill its form in. Never the gender. */
export async function GET(_request: Request, { params }: { params: Promise<{ adminHash: string }> }) {
  const { adminHash } = await params
  const reveal = await loadRevealByAdmin(adminHash)

  if (!reveal) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  return NextResponse.json(
    {
      hash: reveal.hash,
      path: `/r/${reveal.hash}`,
      revealAt: reveal.revealAt,
      expiresAt: reveal.expiresAt,
      config: reveal.config,
      editable: Date.now() < reveal.revealAt,
    },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  )
}

export async function PUT(request: Request, { params }: { params: Promise<{ adminHash: string }> }) {
  const { adminHash } = await params
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

  const result = await updateReveal(adminHash, body)

  if (!result.ok) {
    const status = result.error === 'not_found' ? 404 : result.error === 'already_revealed' ? 409 : 400
    return NextResponse.json({ error: result.error }, { status })
  }

  return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
