import { NextResponse } from 'next/server'
import { revealStore } from '@/lib/store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Retention, enforced on a schedule as well as opportunistically on every
 * creation. Vercel Cron calls this daily with CRON_SECRET as a bearer token.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET

  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const store = await revealStore()
  const removed = await store.purgeExpired(Date.now())

  return NextResponse.json({ removed }, { headers: { 'Cache-Control': 'no-store' } })
}
