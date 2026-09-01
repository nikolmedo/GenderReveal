import { DatabaseSync } from 'node:sqlite'
import type { Gender } from '@/lib/messages'
import { emptyTally, SCHEMA, UPSERT, type VoteStore } from '@/lib/store/types'

/**
 * Development adapter: a real SQLite file through Node's built-in driver, so
 * `npm run dev` needs no account, no network and no native compilation. Never
 * used in production — Vercel's filesystem does not survive between requests.
 */
export function localFileStore(path = 'local.db'): VoteStore {
  let db: DatabaseSync | null = null

  function open(): DatabaseSync {
    if (!db) {
      db = new DatabaseSync(path)
      db.exec(SCHEMA)
    }
    return db
  }

  return {
    async cast(voterId, name, choice) {
      open().prepare(UPSERT).run(voterId, name, choice, Date.now())
    },

    async tally() {
      const rows = open().prepare('SELECT choice, COUNT(*) AS n FROM votes GROUP BY choice').all()
      const counts = emptyTally()

      for (const row of rows as Array<{ choice: Gender; n: number }>) {
        const n = Number(row.n)
        counts[row.choice] = n
        counts.total += n
      }

      return counts
    },

    async countMatching(gender) {
      const row = open()
        .prepare('SELECT COUNT(*) AS n FROM votes WHERE choice = ?')
        .get(gender) as { n: number } | undefined
      return Number(row?.n ?? 0)
    },
  }
}
