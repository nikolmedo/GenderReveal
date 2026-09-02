'use client'

import { fill, type Gender, type RevealCopy } from '@/lib/messages'
import type { Tally, Voters as VoterNames } from '@/lib/store/types'

type Props = {
  copy: RevealCopy
  names: VoterNames
  counts: Tally
  labels: { girl: string; boy: string }
  winner: Gender
}

/**
 * Who guessed what, folded away by default.
 *
 * It arrives only in the reveal payload, so there is nothing to open before the
 * hour. Collapsed to start with because the names are a footnote to the moment,
 * not the moment, and each column scrolls on its own so a long guest list never
 * pushes the announcement off the screen.
 */
export function Voters({ copy, names, counts, labels, winner }: Props) {
  const total = counts.total

  if (total === 0) {
    return <p className="voters__none">{copy.votersEmpty}</p>
  }

  const sides = (['girl', 'boy'] as const).map((side) => ({
    side,
    label: side === 'girl' ? labels.girl : labels.boy,
    count: counts[side],
    // The query is capped, so a very large party shows what it can and says how
    // many it left out. The count in the heading stays the true one.
    listed: [...names[side]].sort((a, b) => a.localeCompare(b, 'es')),
  }))

  return (
    <details className="voters">
      {/* Both labels ship; CSS swaps them on `open`, so the wording follows the
          state without React needing to track it. */}
      <summary className="voters__summary">
        <span className="voters__verb voters__verb--show">{copy.votersShow}</span>
        <span className="voters__verb voters__verb--hide">{copy.votersHide}</span>
      </summary>

      <div className="voters__columns">
        {sides.map(({ side, label, count, listed }) => (
          <div
            className={`voters__side voters__side--${side}${side === winner ? ' voters__side--won' : ''}`}
            key={side}
          >
            <p className="voters__head">
              {label} <b>{count}</b>
            </p>

            <ul className="voters__names">
              {listed.map((name, index) => (
                <li key={`${name}-${index}`}>{name}</li>
              ))}
            </ul>

            {count > listed.length && (
              <p className="voters__more">{fill(copy.votersMore, { count: count - listed.length })}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  )
}
