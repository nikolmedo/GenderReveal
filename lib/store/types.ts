import type { Gender } from '@/lib/messages'

export type Tally = { girl: number; boy: number; total: number }

export type Voters = { girl: string[]; boy: string[] }

export type RevealRow = {
  hash: string
  gender: Gender
  revealAt: number
  expiresAt: number
  /** The public configuration, serialised. Never contains the gender. */
  config: string
}

/**
 * The port. Everything the app needs from persistence, and nothing about how
 * it is stored — which is what lets the same code run on a local SQLite file
 * and on Turso over HTTP.
 */
export type RevealStore = {
  createReveal(row: RevealRow): Promise<void>
  getReveal(hash: string): Promise<RevealRow | null>
  /** Removes reveals past their retention window, and their votes with them. */
  purgeExpired(now: number): Promise<number>

  cast(hash: string, voterId: string, name: string, choice: Gender): Promise<void>
  /** Who voted for what. Only ever read after a reveal has opened. */
  voters(hash: string): Promise<Voters>
  tally(hash: string): Promise<Tally>
  countMatching(hash: string, gender: Gender): Promise<number>
}

// A distinct table name from the single-reveal version, so an older database
// needs no migration: the previous table is simply left behind.
export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS reveals (
     hash       TEXT PRIMARY KEY,
     gender     TEXT NOT NULL CHECK (gender IN ('girl', 'boy')),
     reveal_at  INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     config     TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS reveal_votes (
     hash       TEXT NOT NULL,
     voter_id   TEXT NOT NULL,
     name       TEXT NOT NULL,
     choice     TEXT NOT NULL CHECK (choice IN ('girl', 'boy')),
     created_at INTEGER NOT NULL,
     PRIMARY KEY (hash, voter_id)
   )`,
  `CREATE INDEX IF NOT EXISTS reveal_votes_by_hash ON reveal_votes (hash)`,
  `CREATE INDEX IF NOT EXISTS reveals_by_expiry ON reveals (expires_at)`,
]

export const INSERT_REVEAL = `
  INSERT INTO reveals (hash, gender, reveal_at, expires_at, config, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
`

export const SELECT_REVEAL = `
  SELECT hash, gender, reveal_at, expires_at, config FROM reveals WHERE hash = ?
`

export const UPSERT_VOTE = `
  INSERT INTO reveal_votes (hash, voter_id, name, choice, created_at)
  VALUES (?, ?, ?, ?, ?)
  ON CONFLICT(hash, voter_id) DO UPDATE SET name = excluded.name, choice = excluded.choice
`

export const TALLY = `SELECT choice, COUNT(*) AS n FROM reveal_votes WHERE hash = ? GROUP BY choice`

// Bounded so one enthusiastic guest list cannot turn the reveal payload into a
// download. The counts stay authoritative; the page says how many it left out.
export const VOTERS = `
  SELECT choice, name FROM reveal_votes WHERE hash = ? ORDER BY created_at LIMIT 600
`

export const COUNT_MATCHING = `SELECT COUNT(*) AS n FROM reveal_votes WHERE hash = ? AND choice = ?`

// SQLite has foreign keys off by default, so the votes are deleted by hand
// rather than left to a cascade that would never fire.
export const PURGE_VOTES = `
  DELETE FROM reveal_votes
  WHERE hash IN (SELECT hash FROM reveals WHERE expires_at < ?)
`

export const PURGE_REVEALS = `DELETE FROM reveals WHERE expires_at < ?`

export function emptyVoters(): Voters {
  return { girl: [], boy: [] }
}

export function emptyTally(): Tally {
  return { girl: 0, boy: 0, total: 0 }
}
