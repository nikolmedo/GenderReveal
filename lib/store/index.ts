import type { RevealStore } from '@/lib/store/types'

let store: RevealStore | null = null

/**
 * Async, and the local adapter is imported dynamically, because a static import
 * would evaluate `node:sqlite` at module load on every cold start — including
 * in production, where that adapter is never used and the runtime may not
 * expose the module at all.
 */
export async function revealStore(): Promise<RevealStore> {
  if (store) return store

  const url = process.env.TURSO_DATABASE_URL?.trim()

  if (url) {
    const { tursoStore } = await import('@/lib/store/turso')
    store = tursoStore(url, process.env.TURSO_AUTH_TOKEN?.trim() || undefined)
    return store
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TURSO_DATABASE_URL is missing. The Vercel filesystem is ephemeral: without Turso, reveals and votes are lost between requests.',
    )
  }

  const { localFileStore } = await import('@/lib/store/localFile')
  store = localFileStore()
  return store
}
