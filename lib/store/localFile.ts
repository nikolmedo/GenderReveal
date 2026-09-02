import { DatabaseSync } from 'node:sqlite'
import type { Gender } from '@/lib/messages'
import {
  COUNT_MATCHING,
  emptyTally,
  emptyVoters,
  INSERT_REVEAL,
  MIGRATIONS,
  PURGE_REVEALS,
  PURGE_VOTES,
  SCHEMA,
  SELECT_REVEAL,
  SELECT_REVEAL_BY_ADMIN,
  TALLY,
  UPDATE_REVEAL,
  UPSERT_VOTE,
  VOTERS,
  type RevealStore,
} from '@/lib/store/types'

type RawReveal = {
  hash: string
  admin_hash: string | null
  gender: Gender
  reveal_at: number
  expires_at: number
  config: string
}

function toRow(row: RawReveal | undefined) {
  if (!row) return null

  return {
    hash: row.hash,
    adminHash: row.admin_hash ?? null,
    gender: row.gender,
    revealAt: Number(row.reveal_at),
    expiresAt: Number(row.expires_at),
    config: row.config,
  }
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
      // Expected to fail once the change is already in place; that is the only
      // signal SQLite offers for "column already added".
      for (const statement of MIGRATIONS) {
        try {
          db.exec(statement)
        } catch {
          // already applied
        }
      }
    }
    return db
  }

  return {
    async createReveal(row) {
      open()
        .prepare(INSERT_REVEAL)
        .run(row.hash, row.adminHash, row.gender, row.revealAt, row.expiresAt, row.config, Date.now())
    },

    async getReveal(hash) {
      return toRow(open().prepare(SELECT_REVEAL).get(hash) as RawReveal | undefined)
    },

    async getRevealByAdmin(adminHash) {
      return toRow(open().prepare(SELECT_REVEAL_BY_ADMIN).get(adminHash) as RawReveal | undefined)
    },

    async updateReveal(adminHash, revealAt, expiresAt, config) {
      open().prepare(UPDATE_REVEAL).run(revealAt, expiresAt, config, adminHash)
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

    async voters(hash) {
      const rows = open().prepare(VOTERS).all(hash) as Array<{ choice: Gender; name: string }>
      const names = emptyVoters()

      for (const row of rows) {
        names[row.choice].push(String(row.name))
      }

      return names
    },

    async countMatching(hash, gender) {
      const row = open().prepare(COUNT_MATCHING).get(hash, gender) as { n: number } | undefined
      return Number(row?.n ?? 0)
    },
  }
}
