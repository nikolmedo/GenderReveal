'use client'

import { useEffect, useState } from 'react'
import type { Gender } from '@/lib/messages'

export type MyVote = { voterId: string; name: string; choice: Gender }

const STORAGE_KEY = 'genderreveal:vote:v1'

function newVoterId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

function read(): MyVote | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
export function useMyVote() {
  const [vote, setVote] = useState<MyVote | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setVote(read())
    setLoaded(true)
  }, [])

  const save = (name: string, choice: Gender): MyVote => {
    const next: MyVote = { voterId: vote?.voterId ?? newVoterId(), name, choice }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Private browsing can refuse writes. The vote still counts on the server;
      // this visitor just will not get the personal verdict.
    }
    setVote(next)
    return next
  }

  return { vote, loaded, save }
}
