'use client'

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  COUNTDOWN_LIMITS,
  REVEAL_LIMITS,
  type CountdownCopy,
  type Gender,
  type RevealTexts,
} from '@/lib/messages'
import { derivePalette, paletteVars } from '@/lib/palette'
import { resolveInstant } from '@/lib/time'
import { TimeZonePicker } from '@/components/TimeZonePicker'
import { CopyLink } from '@/components/CopyLink'

type Copy = Record<string, string>

type Defaults = {
  colors: { girl: string; boy: string }
  options: { votingEnabled: boolean; showVoters: boolean }
  countdown: CountdownCopy
  reveal: RevealTexts
}

type Created = { hash: string; url: string; adminUrl: string; title: string; revealAt: number }

export type EditableConfig = {
  countdown: Copy
  reveal: Copy
  colors: { girl: string; boy: string }
  options: { votingEnabled: boolean; showVoters: boolean }
  timeZone: string
  wallClock: string
}

type EditMode = {
  adminHash: string
  config: EditableConfig
  onSaved: () => void
}

const MINE_KEY = 'genderreveal:created:v1'
const TEXTAREA_FROM = 150

const COUNTDOWN_LABELS: Record<keyof CountdownCopy, string> = {
  pageTitle: 'Título de la pestaña',
  eyebrow: 'Etiqueta de arriba',
  title: 'Título principal',
  welcome: 'Bienvenida',
  hostLine: 'Firma del pie',
  votePrompt: 'Pregunta de la votación',
  nameLabel: 'Etiqueta del campo nombre',
  namePlaceholder: 'Texto guía del nombre',
  voteButton: 'Botón de votar',
  voteButtonSending: 'Botón mientras guarda',
  votedConfirmation: 'Confirmación al votar · usa {name}',
  voteClosedNotice: 'Aviso de votación cerrada',
  voteErrorNotice: 'Aviso de error al votar',
  offlineNotice: 'Aviso de sin conexión',
  tallyTitle: 'Título del conteo',
  voteSingular: 'Palabra «voto»',
  votePlural: 'Palabra «votos»',
  girlLabel: 'Cómo se lee la opción nena',
  boyLabel: 'Cómo se lee la opción nene',
  daysLabel: 'Rótulo de días',
  hoursLabel: 'Rótulo de horas',
  minutesLabel: 'Rótulo de minutos',
  secondsLabel: 'Rótulo de segundos',
}

const REVEAL_LABELS: Record<keyof RevealTexts, string> = {
  headline: 'Antetítulo',
  girlText: 'Si es nena, se lee',
  boyText: 'Si es nene, se lee',
  subtitle: 'Subtítulo',
  correct: 'Si acertó · usa {name}',
  wrong: 'Si erró · usa {name}',
  noVote: 'Si no llegó a votar',
  score: 'Marcador · usa {correct} y {total}',
  votersShow: 'Botón para ver la votación',
  votersHide: 'Botón para ocultarla',
  votersEmpty: 'Si no votó nadie',
  votersMore: 'Si la lista se corta · usa {count}',
  hostLine: 'Firma del pie',
}

const ERRORS: Record<string, string> = {
  invalid_gender: 'Elegí nena o nene.',
  invalid_time: 'Revisá la fecha, la hora y la zona horaria.',
  time_in_past: 'Esa hora ya pasó. Elegí un momento futuro.',
  invalid_color: 'Los colores tienen que ser hexadecimales, tipo #ff6f9c.',
  invalid_text: 'Alguno de los textos quedó demasiado largo.',
  invalid_payload: 'No pudimos leer el formulario. Probá de nuevo.',
}

function loadMine(): Created[] {
  try {
    const raw = localStorage.getItem(MINE_KEY)
    return raw ? (JSON.parse(raw) as Created[]) : []
  } catch {
    return []
  }
}

function remember(entry: Created) {
  try {
    const next = [entry, ...loadMine().filter((c) => c.hash !== entry.hash)].slice(0, 12)
    localStorage.setItem(MINE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing refuses writes. The link still exists; it just is not
    // remembered here, which is why it is also shown to be copied.
  }
}

function countdownText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor(total / 3600) % 24
  const minutes = Math.floor(total / 60) % 60

  const parts = [
    days > 0 ? `${days} ${days === 1 ? 'día' : 'días'}` : null,
    hours > 0 ? `${hours} h` : null,
    days === 0 ? `${minutes} min` : null,
  ].filter(Boolean)

  return parts.join(' · ')
}

export function Configurator({
  defaults,
  maxHorizonDays,
  retentionDays,
  edit,
}: {
  defaults: Defaults
  maxHorizonDays: number
  retentionDays: number
  /** Present when the form is rewriting a countdown instead of making one. */
  edit?: EditMode
}) {
  const [startDate, startTime] = (edit?.config.wallClock ?? '').split('T')

  const [gender, setGender] = useState<Gender>('girl')
  const [date, setDate] = useState(startDate ?? '')
  const [time, setTime] = useState(startTime?.slice(0, 5) ?? '20:00')
  const [timeZone, setTimeZone] = useState(edit?.config.timeZone ?? '')
  const [colors, setColors] = useState(edit?.config.colors ?? defaults.colors)
  const [options, setOptions] = useState(edit?.config.options ?? defaults.options)
  const [countdown, setCountdown] = useState<Copy>({ ...defaults.countdown, ...edit?.config.countdown })
  const [reveal, setReveal] = useState<Copy>({ ...defaults.reveal, ...edit?.config.reveal })

  const [now, setNow] = useState(0)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [created, setCreated] = useState<Created | null>(null)
  const [mine, setMine] = useState<Created[]>([])

  // Everything clock- and locale-dependent is filled in after mount, so the
  // server's markup and the client's first render stay identical. When editing,
  // the stored values are already the right ones and must not be overwritten.
  useEffect(() => {
    if (!edit) {
      setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)

      const week = new Date(Date.now() + 7 * 86_400_000)
      const pad = (n: number) => String(n).padStart(2, '0')
      setDate(`${week.getFullYear()}-${pad(week.getMonth() + 1)}-${pad(week.getDate())}`)
    }

    setMine(loadMine())
    setNow(Date.now())

    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const instant = useMemo(
    () => (date && time && timeZone ? resolveInstant(`${date}T${time}`, timeZone) : null),
    [date, time, timeZone],
  )

  const horizonMs = instant !== null && now > 0 ? instant - now : null
  const tooFar = horizonMs !== null && horizonMs > maxHorizonDays * 86_400_000
  const inPast = horizonMs !== null && horizonMs <= 0
  const canSubmit = instant !== null && !tooFar && !inPast && !sending

  const palette = useMemo(() => derivePalette(colors.girl, colors.boy), [colors])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!canSubmit) return

    setSending(true)
    setError(null)

    const payload = {
      gender,
      wallClock: `${date}T${time}`,
      timeZone,
      colors,
      options,
      countdown,
      reveal,
    }

    try {
      const response = await fetch(edit ? `/api/admin/${edit.adminHash}` : '/api/reveals', {
        method: edit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(
          data.error === 'horizon_exceeded'
            ? `No se pueden crear countdowns de más de ${maxHorizonDays} días.`
            : (ERRORS[data.error] ?? 'No pudimos guardar los cambios. Probá de nuevo.'),
        )
        return
      }

      if (edit) {
        edit.onSaved()
        return
      }

      const entry: Created = {
        hash: data.hash,
        url: `${window.location.origin}${data.path}`,
        adminUrl: `${window.location.origin}${data.adminPath}`,
        title: countdown.title,
        revealAt: data.revealAt,
      }

      remember(entry)
      setMine(loadMine())
      setCreated(entry)
    } catch {
      setError('No pudimos guardar. Probá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (created) {
    return (
      <main className="forge forge--done">
        <div className="forge__done" style={paletteVars(palette) as CSSProperties}>
          <p className="forge__eyebrow">Listo</p>
          <h1 className="forge__title">Tu countdown ya existe</h1>

          <div className="handoff">
            <div className="handoff__card">
              <p className="handoff__what">Para tus invitados</p>
              <p className="handoff__why">
                Compartilo con quien quieras. Nadie que lo abra puede ver el sexo hasta la hora que
                elegiste.
              </p>
              <CopyLink url={created.url} />
            </div>

            <div className="handoff__card handoff__card--secret">
              <p className="handoff__what">Solo para vos</p>
              <p className="handoff__why">
                Con este link ves cómo viene la votación sin votar, y podés cambiar los textos, los
                colores y la hora. <strong>No lo compartas</strong>: quien lo tenga puede editar tu
                countdown.
              </p>
              <CopyLink url={created.adminUrl} tone="secret" />
            </div>
          </div>

          <div className="forge__actions">
            <a className="forge__go" href={created.adminUrl}>
              Ir a mi panel
            </a>
            <button type="button" className="forge__again" onClick={() => setCreated(null)}>
              Armar otro
            </button>
          </div>

          <p className="forge__fine">
            Guardá los dos links fuera de este navegador. No hay cuenta ni forma de recuperarlos. El
            countdown y sus votos se borran {retentionDays} días después de la revelación.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="forge">
      <form className="forge__form" onSubmit={submit}>
        {!edit && (
          <header className="forge__header">
            <p className="forge__eyebrow">Armá tu reveal</p>
            <h1 className="forge__title">Un solo instante, en todo el mundo</h1>
            <p className="forge__lead">
              Elegí la hora y el sexo, escribí lo que quieras que se lea, y llevate un link para
              compartir. El reloj llega a cero al mismo tiempo para todos, estén donde estén.
            </p>
          </header>
        )}

        {/* Not editable from the organiser panel: the answer is the one thing
            that must not reach any browser before the hour, this one included. */}
        {!edit && (
        <section className="block">
          <h2 className="block__title">El secreto</h2>
          <p className="block__hint">
            Vive solo en el servidor. No viaja al navegador de nadie hasta que pasa la hora.
          </p>

          <div className="pick" role="group" aria-label="Sexo del bebé">
            {(['girl', 'boy'] as const).map((option) => (
              <button
                type="button"
                key={option}
                className={`pick__option pick__option--${option}${gender === option ? ' pick__option--on' : ''}`}
                aria-pressed={gender === option}
                style={
                  {
                    '--tone': option === 'girl' ? colors.girl : colors.boy,
                    '--tone-deep': option === 'girl' ? palette.girl.deep : palette.boy.deep,
                  } as CSSProperties
                }
                onClick={() => setGender(option)}
              >
                {option === 'girl' ? countdown.girlLabel : countdown.boyLabel}
              </button>
            ))}
          </div>
        </section>
        )}

        <section className="block">
          <h2 className="block__title">Cuándo</h2>

          <div className="when">
            <label className="field">
              <span>Fecha</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>

            <label className="field">
              <span>Hora</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>

            <div className="field field--wide">
              <TimeZonePicker value={timeZone} onChange={setTimeZone} label="Zona horaria" />
            </div>
          </div>

          {horizonMs !== null && (
            <p className={`when__preview${tooFar || inPast ? ' when__preview--bad' : ''}`}>
              {inPast
                ? 'Esa hora ya pasó.'
                : tooFar
                  ? `Son más de ${maxHorizonDays} días. Elegí una fecha más cerca.`
                  : `Faltarían ${countdownText(horizonMs)} desde ahora.`}
            </p>
          )}
        </section>

        <section className="block">
          <h2 className="block__title">Colores</h2>
          <p className="block__hint">
            De estos dos sale toda la paleta: los globos, las tarjetas, el confeti y el cielo del
            final.
          </p>

          <div className="tones">
            {(['girl', 'boy'] as const).map((option) => (
              <label className="tone" key={option}>
                <input
                  type="color"
                  value={colors[option]}
                  onChange={(e) => setColors({ ...colors, [option]: e.target.value })}
                  aria-label={option === 'girl' ? 'Color de nena' : 'Color de nene'}
                />
                <span className="tone__name">
                  {option === 'girl' ? countdown.girlLabel : countdown.boyLabel}
                </span>
                <code className="tone__hex">{colors[option]}</code>
              </label>
            ))}
          </div>

          <div className="sample" style={paletteVars(palette) as CSSProperties} aria-hidden="true">
            {(['girl', 'boy'] as const).map((option) => (
              <span className={`sample__balloon sample__balloon--${option}`} key={option} />
            ))}
          </div>
        </section>

        <section className="block">
          <h2 className="block__title">Opciones</h2>

          <label className="switch">
            <input
              type="checkbox"
              checked={options.votingEnabled}
              onChange={(event) => setOptions({ ...options, votingEnabled: event.target.checked })}
            />
            <span className="switch__text">
              <b>Dejar que voten</b>
              <small>Si lo apagás, la página es solo la cuenta regresiva.</small>
            </span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={options.showVoters}
              onChange={(event) => setOptions({ ...options, showVoters: event.target.checked })}
            />
            <span className="switch__text">
              <b>Mostrar quién votó qué al final</b>
              <small>Con esto apagado, al llegar a cero solo se ven los números.</small>
            </span>
          </label>
        </section>

        <details className="block block--fold">
          <summary className="block__title">Textos de la cuenta regresiva</summary>
          <div className="fields">
            {(Object.keys(COUNTDOWN_LABELS) as Array<keyof CountdownCopy>).map((field) => (
              <Field
                key={field}
                label={COUNTDOWN_LABELS[field]}
                limit={COUNTDOWN_LIMITS[field]}
                value={countdown[field]}
                onChange={(value) => setCountdown({ ...countdown, [field]: value })}
              />
            ))}
          </div>
        </details>

        <details className="block block--fold">
          <summary className="block__title">Textos de la revelación</summary>
          <p className="block__hint">
            Nada de esto llega al navegador hasta que pasa la hora, así que podés escribir lo que
            quieras sin miedo a que alguien lo espíe.
          </p>
          <div className="fields">
            {(Object.keys(REVEAL_LABELS) as Array<keyof RevealTexts>).map((field) => (
              <Field
                key={field}
                label={REVEAL_LABELS[field]}
                limit={REVEAL_LIMITS[field]}
                value={reveal[field]}
                onChange={(value) => setReveal({ ...reveal, [field]: value })}
              />
            ))}
          </div>
        </details>

        {error && <p className="forge__error">{error}</p>}

        <button className="forge__submit" type="submit" disabled={!canSubmit}>
          {sending ? 'Guardando…' : edit ? 'Guardar los cambios' : 'Generar el link'}
        </button>

        <p className="forge__fine">
          Máximo {maxHorizonDays} días de anticipación. El link y los votos se guardan hasta{' '}
          {retentionDays} días después de la revelación.
        </p>

        {!edit && mine.length > 0 && (
          <section className="block">
            <h2 className="block__title">Los que armaste en este navegador</h2>
            <ul className="mine">
              {mine.map((entry) => (
                <li key={entry.hash}>
                  <a href={entry.url}>{entry.title}</a>
                  <code>{entry.hash}</code>
                </li>
              ))}
            </ul>
          </section>
        )}
      </form>
    </main>
  )
}

function Field({
  label,
  limit,
  value,
  onChange,
}: {
  label: string
  limit: number
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className={`field${limit >= TEXTAREA_FROM ? ' field--wide' : ''}`}>
      <span>{label}</span>
      {limit >= TEXTAREA_FROM ? (
        <textarea
          rows={2}
          maxLength={limit}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          type="text"
          maxLength={limit}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  )
}
