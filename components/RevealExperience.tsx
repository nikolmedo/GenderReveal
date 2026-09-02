'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import type { CountdownCopy } from '@/lib/messages'
import { useMyVote } from '@/lib/myVote'
import { useRevealState } from '@/lib/useRevealState'
import { Balloons } from '@/components/Balloons'
import { Confetti } from '@/components/Confetti'
import { Countdown } from '@/components/Countdown'
import { VotePanel } from '@/components/VotePanel'
import { Reveal } from '@/components/Reveal'

type Props = {
  hash: string
  revealAt: number
  serverNow: number
  copy: CountdownCopy
  palette: Record<string, string>
  votingEnabled: boolean
}

export function RevealExperience({ hash, revealAt, serverNow, copy, palette, votingEnabled }: Props) {
  const state = useRevealState(hash, revealAt, serverNow)
  const { vote, loaded, save } = useMyVote(hash)

  // Hold one beat after the server confirms, so the balloons bursting and the
  // sky changing colour read as an event rather than a repaint.
  const [curtain, setCurtain] = useState(false)
  useEffect(() => {
    if (!state.revealed) return
    const id = setTimeout(() => setCurtain(true), 400)
    return () => clearTimeout(id)
  }, [state.revealed])

  const winner = curtain ? state.gender : null
  const showReveal = winner !== null && state.copy !== null
  const closing = state.revealed || state.remainingMs <= 0

  // The creator's two colours drive every shade on the page. The winning
  // tint only arrives with the reveal payload, so it cannot be read early.
  const skin: CSSProperties = { ...palette } as CSSProperties
  if (winner && state.tint) {
    Object.assign(skin, {
      '--tint-1': state.tint[0],
      '--tint-2': state.tint[1],
      '--tint-3': state.tint[2],
    })
  }

  return (
    // The balloons sit outside the countdown/reveal swap on purpose: they are
    // the thread that carries the moment across, instead of one screen being
    // replaced by another.
    <div className={`world${winner ? ` world--${winner}` : ''}`} style={skin}>
      <div className="sky" aria-hidden="true" />
      <Balloons winner={winner} />
      {winner && <Confetti gender={winner} />}

      {showReveal ? (
        <Reveal
          copy={state.copy!}
          gender={winner}
          counts={state.counts}
          correct={state.correct}
          myVote={vote}
          names={state.voters}
          labels={{ girl: copy.girlLabel, boy: copy.boyLabel }}
        />
      ) : (
        <main className={`stage${closing ? ' stage--closing' : ''}`}>
          <div className="stage__inner">
            <header className="intro">
              <p className="intro__eyebrow">{copy.eyebrow}</p>
              <h1 className="intro__title">{copy.title}</h1>
              <p className="intro__welcome">{copy.welcome}</p>
            </header>

            <Countdown remainingMs={state.remainingMs} copy={copy} ready={state.ready} />

            {votingEnabled && (
            <VotePanel
              hash={hash}
              copy={copy}
              counts={state.counts}
              myVote={vote}
              voteLoaded={loaded}
              closed={closing}
              onSaved={save}
              onCounts={state.applyCounts}
            />
            )}

            <footer className="outro">
              <p>{copy.hostLine}</p>
              {state.offline && <p className="outro__warning">{copy.offlineNotice}</p>}
            </footer>
          </div>
        </main>
      )}
    </div>
  )
}
