import { createClient, type Client } from '@libsql/client/web'
import type { Gender } from '@/lib/messages'
import { emptyTally, SCHEMA, UPSERT, type Tally, type VoteStore } from '@/lib/store/types'

/**
 * Production adapter.
 *
 * Deliberately the `/web` entry point: it speaks HTTP and pulls in no native
 * binding, which is the only shape that survives a serverless function — and
 * the only one that builds on every architecture.
 */
export function tursoStore(url: string, authToken?: string): VoteStore {
  let client: Client | null = null
  let ready: Promise<void> | null = null

  async function connect(): Promise<Client> {
    client ??= createClient({ url, authToken })
    ready ??= client.execute(SCHEMA).then(() => undefined)
    await ready
    return client
  }

  return {
    async cast(voterId, name, choice) {
      const db = await connect()
      await db.execute({ sql: UPSERT, args: [voterId, name, choice, Date.now()] })
    },

    async tally() {
      const db = await connect()
      const result = await db.execute('SELECT choice, COUNT(*) AS n FROM votes GROUP BY choice')
      const counts = emptyTally()

      for (const row of result.rows) {
        const n = Number(row.n)
        counts[row.choice as Gender] = n
        counts.total += n
      }

      return counts satisfies Tally
    },

    async countMatching(gender) {
      const db = await connect()
      const result = await db.execute({
        sql: 'SELECT COUNT(*) AS n FROM votes WHERE choice = ?',
        args: [gender],
      })
      return Number(result.rows[0]?.n ?? 0)
    },
  }
}
