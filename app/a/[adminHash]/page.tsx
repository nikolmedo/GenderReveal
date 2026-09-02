import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { AdminPanel } from '@/components/AdminPanel'
import { defaultConfig } from '@/lib/messages'
import { paletteVars } from '@/lib/palette'
import { loadRevealByAdmin, MAX_HORIZON_DAYS, RETENTION_DAYS } from '@/lib/reveals'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Tu panel',
  robots: { index: false, follow: false },
}

type Params = { params: Promise<{ adminHash: string }> }

/**
 * The organiser's door. It hands down the configuration and the public link,
 * and — exactly like the guest page — nothing about the gender: that still only
 * comes from /api/reveals/[hash]/state, and only once the moment has passed.
 */
export default async function AdminPage({ params }: Params) {
  const { adminHash } = await params
  const reveal = await loadRevealByAdmin(adminHash)

  if (!reveal) notFound()

  const head = await headers()
  const host = head.get('x-forwarded-host') ?? head.get('host') ?? ''
  const protocol = head.get('x-forwarded-proto') ?? 'http'

  return (
    <AdminPanel
      adminHash={adminHash}
      hash={reveal.hash}
      shareUrl={`${protocol}://${host}/r/${reveal.hash}`}
      revealAt={reveal.revealAt}
      serverNow={Date.now()}
      config={reveal.config}
      palette={paletteVars(reveal.palette)}
      defaults={defaultConfig}
      maxHorizonDays={MAX_HORIZON_DAYS}
      retentionDays={RETENTION_DAYS}
    />
  )
}
