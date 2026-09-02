'use client'

import { useEffect, useState } from 'react'
import { fill, type Gender, type RevealCopy } from '@/lib/messages'
import type { MyVote } from '@/lib/myVote'
import type { Tally, Voters as VoterNames } from '@/lib/store/types'
import { Voters } from '@/components/Voters'

type Props = {
  copy: RevealCopy
  gender: Gender
  counts: Tally
  correct: number
  myVote: MyVote | null
  names: VoterNames | null
  labels: { girl: string; boy: string }
}

export function Reveal({ copy, gender, counts, correct, myVote, names, labels }: Props) {
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
          {counts.total > 0 && (
            <p className="verdict__score">{fill(copy.score, { correct, total: counts.total })}</p>
          )}
        </div>

        {names && (
          <Voters copy={copy} names={names} counts={counts} labels={labels} winner={gender} />
        )}

        <p className="reveal__host">{copy.hostLine}</p>
      </div>
    </main>
  )
}
