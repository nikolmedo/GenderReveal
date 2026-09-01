import type { Gender } from '@/lib/messages'

export type Tally = { girl: number; boy: number; total: number }

/**
 * The port. Everything the app needs from persistence, and nothing about how
 * it is stored — which is what lets the same code run on a local SQLite file
 * and on Turso over HTTP.
 */
export type VoteStore = {
  cast(voterId: string, name: string, choice: Gender): Promise<void>
  tally(): Promise<Tally>
  countMatching(gender: Gender): Promise<number>
}

export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS votes (
    voter_id   TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    choice     TEXT NOT NULL CHECK (choice IN ('girl', 'boy')),
    created_at INTEGER NOT NULL
  )
`

export const UPSERT = `
  INSERT INTO votes (voter_id, name, choice, created_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(voter_id) DO UPDATE SET name = excluded.name, choice = excluded.choice
`

export function emptyTally(): Tally {
  return { girl: 0, boy: 0, total: 0 }
}
