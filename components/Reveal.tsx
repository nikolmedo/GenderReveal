'use client'

import { useEffect, useState } from 'react'
import { fill, type Gender, type RevealCopy } from '@/lib/messages'
import type { MyVote } from '@/lib/myVote'

type Props = {
  copy: RevealCopy
  gender: Gender
  total: number
  correct: number
  myVote: MyVote | null
}

export function Reveal({ copy, gender, total, correct, myVote }: Props) {
  // Staged entrance: the word lands first, the personal verdict a beat later.
  const [act, setAct] = useState(0)
  useEffect(() => {
    const timers = [setTimeout(() => setAct(1), 1000), setTimeout(() => setAct(2), 2200)]
    return () => timers.forEach(clearTimeout)
  }, [])

  const guessedRight = myVote?.choice === gender

  const verdict = !myVote
    ? copy.noVote
    : guessedRight
      ? fill(copy.correct, { name: myVote.name })
      : fill(copy.wrong, { name: myVote.name })

  const verdictTone = myVote ? (guessedRight ? ' verdict__line--hit' : ' verdict__line--miss') : ''

  return (
    <main className={`reveal reveal--${gender}`} data-act={act}>
      <div className="reveal__inner">
        <p className="reveal__headline">{copy.headline}</p>
        <h1 className="reveal__word">{copy.word}</h1>
        <p className="reveal__subtitle">{copy.subtitle}</p>

        <div className="verdict">
          <p className={`verdict__line${verdictTone}`}>{verdict}</p>
          <p className="verdict__score">{fill(copy.score, { correct, total })}</p>
        </div>

        <p className="reveal__host">{copy.hostLine}</p>
      </div>
    </main>
  )
}
