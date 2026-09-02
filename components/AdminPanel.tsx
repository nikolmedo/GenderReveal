'use client'

import { useState, type CSSProperties } from 'react'
import { Configurator, type EditableConfig } from '@/components/Configurator'
import { CopyLink } from '@/components/CopyLink'
import { copyFor, type Copy } from '@/lib/i18n'
import { fill } from '@/lib/messages'
import { useRevealState } from '@/lib/useRevealState'

type Defaults = {
  colors: { girl: string; boy: string }
  options: { votingEnabled: boolean; showVoters: boolean }
}

type Props = {
  adminHash: string
  hash: string
  shareUrl: string
  revealAt: number
  serverNow: number
  config: EditableConfig
  palette: Record<string, string>
  defaults: Defaults
  maxHorizonDays: number
  retentionDays: number
}

function remaining(ms: number, units: Copy['ui']['units']): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor(total / 3600) % 24
  const minutes = Math.floor(total / 60) % 60

  if (days > 0) return `${days} ${days === 1 ? units.day : units.days} · ${hours} ${units.hour}`
  if (hours > 0) return `${hours} ${units.hour} · ${minutes} ${units.minute}`
  return `${minutes} ${units.minute}`
}

/**
 * The organiser's own view.
 *
 * It reads the same public endpoint everyone else does, so it learns the answer
 * at exactly the same moment they do. What it adds is the running tally without
 * having to vote, the link to hand out, and the form to change their mind about
 * the wording.
 */
export function AdminPanel({
  adminHash,
  hash,
  shareUrl,
  revealAt,
  serverNow,
  config,
  palette,
  defaults,
  maxHorizonDays,
  retentionDays,
}: Props) {
  // The panel speaks whatever language the countdown was made in.
  const t = copyFor(config.locale)
  const state = useRevealState(hash, revealAt, serverNow)
  const [saved, setSaved] = useState(false)

  const counts = state.counts
  const girlShare = counts.total === 0 ? 50 : (counts.girl / counts.total) * 100
  const open = !state.revealed && state.remainingMs > 0

  return (
    <main className="panelio" style={palette as CSSProperties}>
      <div className="panelio__inner">
        <header className="forge__header">
          <p className="forge__eyebrow">{t.ui.panel.eyebrow}</p>
          <h1 className="forge__title">{config.countdown.title}</h1>
          <p className="forge__lead">
            {open
              ? fill(t.ui.panel.leadOpen, { left: remaining(state.remainingMs, t.ui.units) })
              : t.ui.panel.leadDone}
          </p>
        </header>

        <section className="block">
          <h2 className="block__title">{t.ui.panel.shareTitle}</h2>
          <p className="block__hint">{t.ui.panel.shareHint}</p>
          <CopyLink url={shareUrl} copy={t.ui.link} />
          <div className="forge__actions">
            <a className="forge__go" href={shareUrl}>
              {t.ui.panel.openGuests}
            </a>
          </div>
        </section>

        <section className="block">
          <h2 className="block__title">{t.ui.panel.tallyTitle}</h2>

          {!config.options.votingEnabled ? (
            <p className="block__hint">{t.ui.panel.votingOff}</p>
          ) : counts.total === 0 ? (
            <p className="block__hint">{t.ui.panel.noVotes}</p>
          ) : (
            <div className="tally">
              <div
                className="tally__bar"
                role="img"
                aria-label={`${counts.girl} ${config.countdown.girlLabel}, ${counts.boy} ${config.countdown.boyLabel}`}
              >
                <span className="tally__fill tally__fill--girl" style={{ width: `${girlShare}%` }} />
                <span className="tally__fill tally__fill--boy" style={{ width: `${100 - girlShare}%` }} />
              </div>

              <div className="tally__legend">
                <span className="ink ink--girl">
                  {config.countdown.girlLabel} <b>{counts.girl}</b>
                </span>
                <span className="tally__total">
                  {counts.total} {counts.total === 1 ? config.countdown.voteSingular : config.countdown.votePlural}
                </span>
                <span className="ink ink--boy">
                  <b>{counts.boy}</b> {config.countdown.boyLabel}
                </span>
              </div>
            </div>
          )}
        </section>

        {open ? (
          <>
            <header className="panelio__editing">
              <h2 className="forge__title">{t.ui.panel.editTitle}</h2>
              <p className="forge__lead">{t.ui.panel.editHint}</p>
              {saved && <p className="panelio__saved">{t.ui.panel.saved}</p>}
            </header>

            <Configurator
              defaults={defaults}
              maxHorizonDays={maxHorizonDays}
              retentionDays={retentionDays}
              initialLocale={config.locale}
              edit={{
                adminHash,
                config,
                onSaved: () => {
                  setSaved(true)
                  // Straight from the database, so what the form shows next is
                  // what the guests will actually get.
                  window.location.reload()
                },
              }}
            />
          </>
        ) : (
          <p className="forge__fine">{fill(t.ui.panel.lockedFine, { retention: retentionDays })}</p>
        )}
      </div>
    </main>
  )
}
