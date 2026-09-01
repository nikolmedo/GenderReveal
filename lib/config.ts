import raw from '@/content/reveal.config.json'
import type { Gender, RevealCopy } from '@/lib/messages'

/**
 * The reveal instant, as a single point on the timeline.
 *
 * The source string carries an explicit UTC offset (`-03:00`), so the author
 * picks their timezone once and we never do DST arithmetic: `Date.parse`
 * collapses it to one epoch value that every visitor counts down to, whatever
 * their own clock is set to.
 */
function parseRevealAt(): number {
  const source = process.env.REVEAL_AT?.trim() || raw.revealAt

  if (!/([zZ]|[+-]\d{2}:?\d{2})$/.test(source)) {
    throw new Error(
      `revealAt "${source}" has no timezone offset. Without one, every server reads it differently. Run: npm run reveal-at`,
    )
  }

  const epoch = Date.parse(source)

  if (Number.isNaN(epoch)) {
    throw new Error(`Invalid revealAt: "${source}". Expected format: 2026-10-11T20:00:00-03:00`)
  }

  return epoch
}

export const revealAt = parseRevealAt()

/**
 * Server-only. Never call this from a client component: the entire premise of
 * the app is that this value does not exist in the browser until it is due.
 */
export function secretGender(): Gender {
  const value = process.env.REVEAL_GENDER?.trim().toLowerCase()

  if (value !== 'girl' && value !== 'boy') {
    throw new Error('REVEAL_GENDER must be "girl" or "boy".')
  }

  return value
}

export function isRevealed(now = Date.now()): boolean {
  return now >= revealAt
}

/** Resolves the withheld copy for one gender. Only ever called after the hour. */
export function revealCopy(gender: Gender): RevealCopy {
  const { headline, girlText, boyText, subtitle, correct, wrong, noVote, score, hostLine } = raw.reveal

  return {
    headline,
    word: gender === 'girl' ? girlText : boyText,
    subtitle,
    correct,
    wrong,
    noVote,
    score,
    hostLine,
  }
}
