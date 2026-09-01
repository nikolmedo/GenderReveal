import type { Gender } from '@/lib/messages'
import { votesStore } from '@/lib/store'
import type { Tally } from '@/lib/store/types'

export type { Tally }

const MAX_NAME_LENGTH = 40

export function cleanName(input: unknown): string | null {
  if (typeof input !== 'string') return null
  const name = input.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH)
  return name.length > 0 ? name : null
}

export function cleanChoice(input: unknown): Gender | null {
  return input === 'girl' || input === 'boy' ? input : null
}

export function cleanVoterId(input: unknown): string | null {
  return typeof input === 'string' && /^[a-z0-9-]{8,64}$/i.test(input) ? input : null
}

/** Keyed on voter id, so reloading or changing your mind never inflates the count. */
export async function castVote(voterId: string, name: string, choice: Gender): Promise<void> {
  await (await votesStore()).cast(voterId, name, choice)
}

export async function tally(): Promise<Tally> {
  return (await votesStore()).tally()
}

export async function countMatching(gender: Gender): Promise<number> {
  return (await votesStore()).countMatching(gender)
}
