'use client'

import { useEffect, useState } from 'react'
import type { CountdownCopy } from '@/lib/messages'
import { useMyVote } from '@/lib/myVote'
import { useRevealState } from '@/lib/useRevealState'
import { Countdown } from '@/components/Countdown'
import { VotePanel } from '@/components/VotePanel'
import { Reveal } from '@/components/Reveal'

type Props = {
  revealAt: number
  serverNow: number
  copy: CountdownCopy
}

export function RevealExperience({ revealAt, serverNow, copy }: Props) {
  const state = useRevealState(revealAt, serverNow)
  const { vote, loaded, save } = useMyVote()

  // Hold one beat after the server confirms, so the wash of colour reads as an
  // event rather than a repaint.
  const [curtain, setCurtain] = useState(false)
  useEffect(() => {
    if (!state.revealed) return
    const id = setTimeout(() => setCurtain(true), 450)
    return () => clearTimeout(id)
  }, [state.revealed])

  if (curtain && state.gender && state.copy) {
    return (
      <Reveal
        copy={state.copy}
        gender={state.gender}
        total={state.counts.total}
        correct={state.correct}
        myVote={vote}
      />
    )
  }

  const closing = state.revealed || state.remainingMs <= 0

  return (
    <main className={`stage${closing ? ' stage--closing' : ''}`}>
      <div className="sky" aria-hidden="true" />

      <div className="stage__inner">
        <header className="intro">
          <p className="intro__eyebrow">{copy.eyebrow}</p>
          <h1 className="intro__title">{copy.title}</h1>
          <p className="intro__welcome">{copy.welcome}</p>
        </header>

        <Countdown remainingMs={state.remainingMs} copy={copy} ready={state.ready} />

        <VotePanel
          copy={copy}
          counts={state.counts}
          myVote={vote}
          voteLoaded={loaded}
          closed={closing}
          onSaved={save}
          onCounts={state.applyCounts}
        />

        <footer className="outro">
          <p>{copy.hostLine}</p>
          {state.offline && <p className="outro__warning">{copy.offlineNotice}</p>}
        </footer>
      </div>
    </main>
  )
}
