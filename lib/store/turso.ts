import { createClient, type Client } from '@libsql/client/web'
import type { Gender } from '@/lib/messages'
import {
  COUNT_MATCHING,
  emptyTally,
  INSERT_REVEAL,
  PURGE_REVEALS,
  PURGE_VOTES,
  SCHEMA,
  SELECT_REVEAL,
  TALLY,
  UPSERT_VOTE,
  type RevealRow,
  type RevealStore,
} from '@/lib/store/types'

/**
 * Production adapter.
 *
 * Deliberately the `/web` entry point: it speaks HTTP and pulls in no native
 * binding, which is the only shape that survives a serverless function — and
 * the only one that builds on every architecture.
 */
export function tursoStore(url: string, authToken?: string): RevealStore {
  let client: Client | null = null
  let ready: Promise<void> | null = null

  async function connect(): Promise<Client> {
    client ??= createClient({ url, authToken })
    ready ??= (async () => {
      for (const statement of SCHEMA) await client!.execute(statement)
    })()
    await ready
    return client
  }

  return {
    async createReveal(row) {
      const db = await connect()
      await db.execute({
        sql: INSERT_REVEAL,
        args: [row.hash, row.gender, row.revealAt, row.expiresAt, row.config, Date.now()],
      })
    },

    async getReveal(hash) {
      const db = await connect()
      const result = await db.execute({ sql: SELECT_REVEAL, args: [hash] })
      const row = result.rows[0]
      if (!row) return null

      return {
        hash: String(row.hash),
        gender: row.gender as Gender,
        revealAt: Number(row.reveal_at),
        expiresAt: Number(row.expires_at),
        config: String(row.config),
      }
    },

    async purgeExpired(now) {
      const db = await connect()
      await db.execute({ sql: PURGE_VOTES, args: [now] })
      const result = await db.execute({ sql: PURGE_REVEALS, args: [now] })
      return result.rowsAffected ?? 0
    },

    async cast(hash, voterId, name, choice) {
      const db = await connect()
      await db.execute({ sql: UPSERT_VOTE, args: [hash, voterId, name, choice, Date.now()] })
    },

    async tally(hash) {
      const db = await connect()
      const result = await db.execute({ sql: TALLY, args: [hash] })
      const counts = emptyTally()

      for (const row of result.rows) {
        const n = Number(row.n)
        counts[row.choice as Gender] = n
        counts.total += n
      }

      return counts
    },

    async countMatching(hash, gender) {
      const db = await connect()
      const result = await db.execute({ sql: COUNT_MATCHING, args: [hash, gender] })
      return Number(result.rows[0]?.n ?? 0)
    },
  }
}

export type { RevealRow }
