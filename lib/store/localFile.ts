import { DatabaseSync } from 'node:sqlite'
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
  type RevealStore,
} from '@/lib/store/types'

type RawReveal = {
  hash: string
  gender: Gender
  reveal_at: number
  expires_at: number
  config: string
}

/**
 * Development adapter: a real SQLite file through Node's built-in driver, so
 * `npm run dev` needs no account, no network and no native compilation. Never
 * used in production — Vercel's filesystem does not survive between requests.
 */
export function localFileStore(path = 'local.db'): RevealStore {
  let db: DatabaseSync | null = null

  function open(): DatabaseSync {
    if (!db) {
      db = new DatabaseSync(path)
      for (const statement of SCHEMA) db.exec(statement)
    }
    return db
  }

  return {
    async createReveal(row) {
      open()
        .prepare(INSERT_REVEAL)
        .run(row.hash, row.gender, row.revealAt, row.expiresAt, row.config, Date.now())
    },

    async getReveal(hash) {
      const row = open().prepare(SELECT_REVEAL).get(hash) as RawReveal | undefined
      if (!row) return null

      return {
        hash: row.hash,
        gender: row.gender,
        revealAt: Number(row.reveal_at),
        expiresAt: Number(row.expires_at),
        config: row.config,
      }
    },

    async purgeExpired(now) {
      const handle = open()
      handle.prepare(PURGE_VOTES).run(now)
      return Number(handle.prepare(PURGE_REVEALS).run(now).changes ?? 0)
    },

    async cast(hash, voterId, name, choice) {
      open().prepare(UPSERT_VOTE).run(hash, voterId, name, choice, Date.now())
    },

    async tally(hash) {
      const rows = open().prepare(TALLY).all(hash) as Array<{ choice: Gender; n: number }>
      const counts = emptyTally()

      for (const row of rows) {
        const n = Number(row.n)
        counts[row.choice] = n
        counts.total += n
      }

      return counts
    },

    async countMatching(hash, gender) {
      const row = open().prepare(COUNT_MATCHING).get(hash, gender) as { n: number } | undefined
      return Number(row?.n ?? 0)
    },
  }
}
