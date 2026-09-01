import type { Gender } from '@/lib/messages'

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
