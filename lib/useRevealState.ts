'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Gender, RevealCopy } from '@/lib/messages'
import type { Tally, Voters } from '@/lib/store/types'

export type RevealState = {
  ready: boolean
  offline: boolean
  revealed: boolean
  remainingMs: number
  counts: Tally
  gender: Gender | null
  correct: number
  copy: RevealCopy | null
  tint: [string, string, string] | null
  voters: Voters | null
}

type Payload = {
  serverNow: number
  revealAt: number
  revealed: boolean
  counts: Tally
  gender?: Gender
  correct?: number
  copy?: RevealCopy
  tint?: [string, string, string]
  voters?: Voters
}

const IDLE_POLL_MS = 8_000
const UNLOCK_POLL_MS = 1_200
const TICK_MS = 200

export function useRevealState(hash: string, revealAt: number, serverNow: number) {
  const [state, setState] = useState<RevealState>({
    ready: false,
    offline: false,
    revealed: false,
    // Seeded from the server's clock, not the browser's, so hydration matches.
    remainingMs: Math.max(0, revealAt - serverNow),
    counts: { girl: 0, boy: 0, total: 0 },
    gender: null,
    correct: 0,
    copy: null,
    tint: null,
    voters: null,
  })

  /**
   * How wrong this browser's clock is, measured against the server. Everything
   * downstream counts against `Date.now() + skew`, so a laptop set three hours
   * off still hits zero at the same instant as everyone else.
   */
  const skew = useRef(0)

  const sync = useCallback(async () => {
    try {
      const response = await fetch(`/api/reveals/${hash}/state`, { cache: 'no-store' })
      if (!response.ok) throw new Error(String(response.status))

      const data: Payload = await response.json()
      skew.current = data.serverNow - Date.now()

      setState((previous) => ({
        ...previous,
        ready: true,
        offline: false,
        revealed: data.revealed,
        counts: data.counts,
        gender: data.gender ?? null,
        correct: data.correct ?? 0,
        copy: data.copy ?? null,
        tint: data.tint ?? null,
        voters: data.voters ?? null,
      }))
    } catch {
      setState((previous) => ({ ...previous, ready: true, offline: true }))
    }
  }, [hash])

  // Countdown ticker, driven by the corrected clock.
  useEffect(() => {
    const tick = () =>
      setState((previous) => ({
        ...previous,
        remainingMs: Math.max(0, revealAt - (Date.now() + skew.current)),
      }))

    tick()
    const id = setInterval(tick, TICK_MS)
    return () => clearInterval(id)
  }, [revealAt])

  const atZero = state.remainingMs <= 0

  // Slow polling while there is time left; fast once the local clock reaches
  // zero, because the server is the one that actually opens the envelope and it
  // may be a beat behind us.
  useEffect(() => {
    if (state.revealed) return

    void sync()
    const id = setInterval(sync, atZero ? UNLOCK_POLL_MS : IDLE_POLL_MS)
    return () => clearInterval(id)
  }, [sync, state.revealed, atZero])

  // A tab left open in the background drifts; catch up the moment it returns.
  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
    }
  }, [sync])

  const applyCounts = useCallback(
    (counts: Tally) => setState((previous) => ({ ...previous, counts })),
    [],
  )

  return { ...state, refresh: sync, applyCounts }
}
