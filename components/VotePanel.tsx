'use client'

import { useState, type FormEvent } from 'react'
import { fill, type CountdownCopy, type Gender } from '@/lib/messages'
import type { MyVote } from '@/lib/myVote'
import type { Tally } from '@/lib/store/types'

type Props = {
  copy: CountdownCopy
  counts: Tally
  myVote: MyVote | null
  voteLoaded: boolean
  closed: boolean
  onSaved: (name: string, choice: Gender) => MyVote
  onCounts: (counts: Tally) => void
}

export function VotePanel({ copy, counts, myVote, voteLoaded, closed, onSaved, onCounts }: Props) {
  const [name, setName] = useState('')
  const [choice, setChoice] = useState<Gender | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || !choice || sending) return

    setSending(true)
    setError(null)

    const pending = onSaved(trimmed, choice)

    try {
      const response = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      })

      if (response.status === 409) {
        setError(copy.voteClosedNotice)
        return
      }
      if (!response.ok) throw new Error(String(response.status))

      const data: { counts: Tally } = await response.json()
      onCounts(data.counts)
    } catch {
      setError(copy.voteErrorNotice)
    } finally {
      setSending(false)
    }
  }

  if (!voteLoaded) return <section className="panel panel--ghost" aria-hidden="true" />

  return (
    <section className="panel">
      {myVote ? (
        <p className="panel__confirmation">
          {fill(copy.votedConfirmation, { name: myVote.name })}{' '}
          <strong className={`ink ink--${myVote.choice}`}>
            {myVote.choice === 'girl' ? copy.girlLabel : copy.boyLabel}
          </strong>
        </p>
      ) : closed ? (
        <p className="panel__confirmation">{copy.voteClosedNotice}</p>
      ) : (
        <form className="ballot" onSubmit={submit}>
          <p className="ballot__prompt">{copy.votePrompt}</p>

          <div className="ballot__choices" role="group" aria-label={copy.votePrompt}>
            {(['girl', 'boy'] as const).map((option) => (
              <button
                type="button"
                key={option}
                className={`choice choice--${option}${choice === option ? ' choice--picked' : ''}`}
                aria-pressed={choice === option}
                onClick={() => setChoice(option)}
              >
                {option === 'girl' ? copy.girlLabel : copy.boyLabel}
              </button>
            ))}
          </div>

          <label className="ballot__field">
            <span>{copy.nameLabel}</span>
            <input
              type="text"
              value={name}
              maxLength={40}
              autoComplete="name"
              placeholder={copy.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>

          <button className="ballot__submit" type="submit" disabled={!name.trim() || !choice || sending}>
            {sending ? copy.voteButtonSending : copy.voteButton}
          </button>

          {error && <p className="ballot__error">{error}</p>}
        </form>
      )}

      <TallyBar counts={counts} copy={copy} />
    </section>
  )
}

function TallyBar({ counts, copy }: { counts: Tally; copy: CountdownCopy }) {
  const girlShare = counts.total === 0 ? 50 : (counts.girl / counts.total) * 100

  return (
    <div className="tally">
      <p className="tally__title">{copy.tallyTitle}</p>

      <div
        className="tally__bar"
        role="img"
        aria-label={`${counts.girl} ${copy.girlLabel}, ${counts.boy} ${copy.boyLabel}`}
      >
        <span className="tally__fill tally__fill--girl" style={{ width: `${girlShare}%` }} />
        <span className="tally__fill tally__fill--boy" style={{ width: `${100 - girlShare}%` }} />
      </div>

      <div className="tally__legend">
        <span className="ink ink--girl">
          {copy.girlLabel} <b>{counts.girl}</b>
        </span>
        <span className="tally__total">
          {counts.total} {counts.total === 1 ? copy.voteSingular : copy.votePlural}
        </span>
        <span className="ink ink--boy">
          <b>{counts.boy}</b> {copy.boyLabel}
        </span>
      </div>
    </div>
  )
}
