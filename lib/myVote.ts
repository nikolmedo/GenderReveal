'use client'

import { useEffect, useState } from 'react'
import type { Gender } from '@/lib/messages'

export type MyVote = { voterId: string; name: string; choice: Gender }

// Keyed per reveal: one browser can be a guest at two parties at once, and
// each one owes that guest its own verdict.
const storageKey = (hash: string) => `genderreveal:vote:v1:${hash}`

function newVoterId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function read(key: string): MyVote | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<MyVote>
    if (!parsed.voterId || !parsed.name || (parsed.choice !== 'girl' && parsed.choice !== 'boy')) return null
    return parsed as MyVote
  } catch {
    return null
  }
}

/**
 * The visitor's own guess, kept in their browser so the reveal can tell them
 * personally whether they got it right — without the server ever needing to
 * know who they are.
 */
export function useMyVote(hash: string) {
  const [vote, setVote] = useState<MyVote | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setVote(read(storageKey(hash)))
    setLoaded(true)
  }, [hash])

  const save = (name: string, choice: Gender): MyVote => {
    const next: MyVote = { voterId: vote?.voterId ?? newVoterId(), name, choice }
    try {
      localStorage.setItem(storageKey(hash), JSON.stringify(next))
    } catch {
      // Private browsing can refuse writes. The vote still counts on the server;
      // this visitor just will not get the personal verdict.
    }
    setVote(next)
    return next
  }

  return { vote, loaded, save }
}
