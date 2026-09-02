'use client'

import { useState, type CSSProperties } from 'react'
import { Configurator, type EditableConfig } from '@/components/Configurator'
import { CopyLink } from '@/components/CopyLink'
import type { CountdownCopy, RevealTexts } from '@/lib/messages'
import { useRevealState } from '@/lib/useRevealState'

type Defaults = {
  colors: { girl: string; boy: string }
  options: { votingEnabled: boolean; showVoters: boolean }
  countdown: CountdownCopy
  reveal: RevealTexts
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

function remaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor(total / 3600) % 24
  const minutes = Math.floor(total / 60) % 60

  if (days > 0) return `${days} ${days === 1 ? 'día' : 'días'} y ${hours} h`
  if (hours > 0) return `${hours} h y ${minutes} min`
  return `${minutes} min`
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
  const state = useRevealState(hash, revealAt, serverNow)
  const [saved, setSaved] = useState(false)

  const counts = state.counts
  const girlShare = counts.total === 0 ? 50 : (counts.girl / counts.total) * 100
  const open = !state.revealed && state.remainingMs > 0

  return (
    <main className="panelio" style={palette as CSSProperties}>
      <div className="panelio__inner">
        <header className="forge__header">
          <p className="forge__eyebrow">Tu panel</p>
          <h1 className="forge__title">{config.countdown.title}</h1>
          <p className="forge__lead">
            {open
              ? `Faltan ${remaining(state.remainingMs)}. Nadie sabe el resultado todavía, vos tampoco lo vas a ver acá antes de tiempo.`
              : 'Ya llegó a cero. Abrí el link para ver la revelación.'}
          </p>
        </header>

        <section className="block">
          <h2 className="block__title">El link para tus invitados</h2>
          <p className="block__hint">Este es el que se comparte. El de esta página, no.</p>
          <CopyLink url={shareUrl} />
          <div className="forge__actions">
            <a className="forge__go" href={shareUrl}>
              Abrir la página de invitados
            </a>
          </div>
        </section>

        <section className="block">
          <h2 className="block__title">Cómo viene la votación</h2>

          {!config.options.votingEnabled ? (
            <p className="block__hint">La votación está apagada para este countdown.</p>
          ) : counts.total === 0 ? (
            <p className="block__hint">Todavía no votó nadie.</p>
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
              <h2 className="forge__title">Cambiar la configuración</h2>
              <p className="forge__lead">
                Se aplica al link que ya compartiste. El sexo no se toca desde acá.
              </p>
              {saved && <p className="panelio__saved">Guardado.</p>}
            </header>

            <Configurator
              defaults={defaults}
              maxHorizonDays={maxHorizonDays}
              retentionDays={retentionDays}
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
          <p className="forge__fine">
            La configuración ya no se puede cambiar: el momento pasó. Todo se borra {retentionDays}{' '}
            días después.
          </p>
        )}
      </div>
    </main>
  )
}
