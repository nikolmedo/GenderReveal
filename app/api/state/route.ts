import { NextResponse } from 'next/server'
import { isRevealed, revealAt, revealCopy, secretGender } from '@/lib/config'
import { countMatching, tally } from '@/lib/votes'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * The only place the countdown gets its truth.
 *
 * `serverNow` lets every browser correct its own clock drift, so a visitor
 * whose system time is wrong still hits zero at the same instant as everyone
 * else. And the entire reveal — gender, wording, score — is simply absent from
 * the payload until the server itself says the moment has passed. That is what
 * keeps the secret out of DevTools.
 */
export async function GET() {
  // Read the secret on every request, including hours before the reveal, so a
  // missing or misspelled REVEAL_GENDER fails on the first visit rather than at
  // T-0 — the one moment this app exists for.
  const gender = secretGender()

  const serverNow = Date.now()
  const revealed = isRevealed(serverNow)

  const body: Record<string, unknown> = {
    serverNow,
    revealAt,
    revealed,
    counts: await tally(),
  }

  if (revealed) {
    body.gender = gender
    body.correct = await countMatching(gender)
    body.copy = revealCopy(gender)
  }

  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
