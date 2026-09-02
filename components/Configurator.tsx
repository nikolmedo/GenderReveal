'use client'

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  COUNTDOWN_LIMITS,
  REVEAL_LIMITS,
  fill,
  type CountdownCopy,
  type Gender,
  type RevealTexts,
} from '@/lib/messages'
import { copyFor, isLocale, LOCALES, LOCALE_NAMES, type Copy, type Locale } from '@/lib/i18n'
import { derivePalette, paletteVars } from '@/lib/palette'
import { resolveInstant } from '@/lib/time'
import { TimeZonePicker } from '@/components/TimeZonePicker'
import { CopyLink } from '@/components/CopyLink'

type Fields = Record<string, string>

type Defaults = {
  colors: { girl: string; boy: string }
  options: { votingEnabled: boolean; showVoters: boolean }
}

type Created = { hash: string; url: string; adminUrl: string; title: string; revealAt: number }

export type EditableConfig = {
  countdown: Fields
  reveal: Fields
  colors: { girl: string; boy: string }
  options: { votingEnabled: boolean; showVoters: boolean }
  locale: Locale
  timeZone: string
  wallClock: string
}

type EditMode = {
  adminHash: string
  config: EditableConfig
  onSaved: () => void
}

const MINE_KEY = 'genderreveal:created:v1'
const LOCALE_KEY = 'genderreveal:locale:v1'
const TEXTAREA_FROM = 150

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

/**
 * Swaps the wording of every field the creator has not touched.
 *
 * A field still holding the old language's default was never edited, so it
 * follows the switch. One they typed into is theirs and stays put — otherwise
 * flipping the language would quietly throw away their writing.
 */
function relocalise(current: Fields, from: Fields, to: Fields): Fields {
  const next: Fields = { ...current }

  for (const key of Object.keys(to)) {
    if (next[key] === from[key]) next[key] = to[key]
  }

  return next
}

function humanGap(ms: number, units: Copy['ui']['units']): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor(total / 3600) % 24
  const minutes = Math.floor(total / 60) % 60

  return [
    days > 0 ? `${days} ${days === 1 ? units.day : units.days}` : null,
    hours > 0 ? `${hours} ${units.hour}` : null,
    days === 0 ? `${minutes} ${units.minute}` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export function Configurator({
  defaults,
  maxHorizonDays,
  retentionDays,
  initialLocale,
  edit,
}: {
  defaults: Defaults
  maxHorizonDays: number
  retentionDays: number
  initialLocale: Locale
  /** Present when the form is rewriting a countdown instead of making one. */
  edit?: EditMode
}) {
  const [startDate, startTime] = (edit?.config.wallClock ?? '').split('T')

  // A countdown speaks the language it was made in, so editing never offers the
  // switch; only the landing does.
  const [locale, setLocale] = useState<Locale>(edit?.config.locale ?? initialLocale)
  const t = copyFor(locale)

  const [gender, setGender] = useState<Gender>('girl')
  const [date, setDate] = useState(startDate ?? '')
  const [time, setTime] = useState(startTime?.slice(0, 5) ?? '20:00')
  const [timeZone, setTimeZone] = useState(edit?.config.timeZone ?? '')
  const [colors, setColors] = useState(edit?.config.colors ?? defaults.colors)
  const [options, setOptions] = useState(edit?.config.options ?? defaults.options)
  const [countdown, setCountdown] = useState<Fields>({
    ...copyFor(edit?.config.locale ?? initialLocale).countdown,
    ...edit?.config.countdown,
  })
  const [reveal, setReveal] = useState<Fields>({
    ...copyFor(edit?.config.locale ?? initialLocale).reveal,
    ...edit?.config.reveal,
  })

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

      // The server guessed from Accept-Language; a previous choice beats it.
      try {
        const remembered = localStorage.getItem(LOCALE_KEY)
        if (isLocale(remembered) && remembered !== locale) switchTo(remembered)
      } catch {
        // Nothing remembered, or storage refused. The header's guess stands.
      }
    }

    setMine(loadMine())
    setNow(Date.now())

    const id = setInterval(() => setNow(Date.now()), 20_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function switchTo(next: Locale) {
    const from = copyFor(locale)
    const to = copyFor(next)

    setCountdown((current) => relocalise(current, from.countdown, to.countdown))
    setReveal((current) => relocalise(current, from.reveal, to.reveal))
    setLocale(next)

    try {
      localStorage.setItem(LOCALE_KEY, next)
    } catch {
      // Not remembering the choice is survivable; ignoring it would not be.
    }
  }

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
      locale,
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
        const known = t.ui.errors[data.error as keyof typeof t.ui.errors]
        setError(known ? fill(known, { days: maxHorizonDays }) : t.ui.errors.generic)
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
      setError(t.ui.errors.generic)
    } finally {
      setSending(false)
    }
  }

  if (created) {
    return (
      <main className="forge forge--done">
        <div className="forge__done" style={paletteVars(palette) as CSSProperties}>
          <p className="forge__eyebrow">{t.ui.done.eyebrow}</p>
          <h1 className="forge__title">{t.ui.done.title}</h1>

          <div className="handoff">
            <div className="handoff__card">
              <p className="handoff__what">{t.ui.done.guestsWhat}</p>
              <p className="handoff__why">{t.ui.done.guestsWhy}</p>
              <CopyLink url={created.url} copy={t.ui.link} />
            </div>

            <div className="handoff__card handoff__card--secret">
              <p className="handoff__what">{t.ui.done.secretWhat}</p>
              <p className="handoff__why">
                {t.ui.done.secretWhyBefore}
                <strong>{t.ui.done.secretWhyStrong}</strong>
                {t.ui.done.secretWhyAfter}
              </p>
              <CopyLink url={created.adminUrl} tone="secret" copy={t.ui.link} />
            </div>
          </div>

          <div className="forge__actions">
            <a className="forge__go" href={created.adminUrl}>
              {t.ui.done.goPanel}
            </a>
            <button type="button" className="forge__again" onClick={() => setCreated(null)}>
              {t.ui.done.again}
            </button>
          </div>

          <p className="forge__fine">{fill(t.ui.done.fine, { retention: retentionDays })}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="forge">
      <form className="forge__form" onSubmit={submit}>
        {!edit && (
          <>
            <div className="tongues" role="group" aria-label={t.ui.language}>
              {LOCALES.map((option) => (
                <button
                  type="button"
                  key={option}
                  className={`tongues__pick${option === locale ? ' tongues__pick--on' : ''}`}
                  aria-pressed={option === locale}
                  onClick={() => switchTo(option)}
                >
                  {LOCALE_NAMES[option]}
                </button>
              ))}
            </div>

            <header className="forge__header">
              <p className="forge__eyebrow">{t.ui.forge.eyebrow}</p>
              <h1 className="forge__title">{t.ui.forge.title}</h1>
              <p className="forge__lead">{t.ui.forge.lead}</p>
            </header>
          </>
        )}

        {/* Not editable from the organiser panel: the answer is the one thing
            that must not reach any browser before the hour, this one included. */}
        {!edit && (
          <section className="block">
            <h2 className="block__title">{t.ui.forge.secretTitle}</h2>
            <p className="block__hint">{t.ui.forge.secretHint}</p>

            <div className="pick" role="group" aria-label={t.ui.forge.secretGroup}>
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
          <h2 className="block__title">{t.ui.forge.whenTitle}</h2>

          <div className="when">
            <label className="field">
              <span>{t.ui.forge.dateLabel}</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>

            <label className="field">
              <span>{t.ui.forge.timeLabel}</span>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>

            <div className="field field--wide">
              <TimeZonePicker value={timeZone} onChange={setTimeZone} copy={t.ui.zone} />
            </div>
          </div>

          {horizonMs !== null && (
            <p className={`when__preview${tooFar || inPast ? ' when__preview--bad' : ''}`}>
              {inPast
                ? t.ui.forge.previewPast
                : tooFar
                  ? fill(t.ui.forge.previewTooFar, { days: maxHorizonDays })
                  : fill(t.ui.forge.previewLeft, { left: humanGap(horizonMs, t.ui.units) })}
            </p>
          )}
        </section>

        <section className="block">
          <h2 className="block__title">{t.ui.forge.colorsTitle}</h2>
          <p className="block__hint">{t.ui.forge.colorsHint}</p>

          <div className="tones">
            {(['girl', 'boy'] as const).map((option) => (
              <label className="tone" key={option}>
                <input
                  type="color"
                  value={colors[option]}
                  onChange={(e) => setColors({ ...colors, [option]: e.target.value })}
                  aria-label={option === 'girl' ? t.ui.forge.girlColorLabel : t.ui.forge.boyColorLabel}
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
          <h2 className="block__title">{t.ui.forge.optionsTitle}</h2>

          <label className="switch">
            <input
              type="checkbox"
              checked={options.votingEnabled}
              onChange={(event) => setOptions({ ...options, votingEnabled: event.target.checked })}
            />
            <span className="switch__text">
              <b>{t.ui.forge.votingSwitch}</b>
              <small>{t.ui.forge.votingSwitchHint}</small>
            </span>
          </label>

          <label className="switch">
            <input
              type="checkbox"
              checked={options.showVoters}
              onChange={(event) => setOptions({ ...options, showVoters: event.target.checked })}
            />
            <span className="switch__text">
              <b>{t.ui.forge.votersSwitch}</b>
              <small>{t.ui.forge.votersSwitchHint}</small>
            </span>
          </label>
        </section>

        <details className="block block--fold">
          <summary className="block__title">{t.ui.forge.countdownTextsTitle}</summary>
          <div className="fields">
            {(Object.keys(COUNTDOWN_LIMITS) as Array<keyof CountdownCopy>).map((field) => (
              <Field
                key={field}
                label={t.ui.labels.countdown[field]}
                limit={COUNTDOWN_LIMITS[field]}
                value={countdown[field]}
                onChange={(value) => setCountdown({ ...countdown, [field]: value })}
              />
            ))}
          </div>
        </details>

        <details className="block block--fold">
          <summary className="block__title">{t.ui.forge.revealTextsTitle}</summary>
          <p className="block__hint">{t.ui.forge.revealTextsHint}</p>
          <div className="fields">
            {(Object.keys(REVEAL_LIMITS) as Array<keyof RevealTexts>).map((field) => (
              <Field
                key={field}
                label={t.ui.labels.reveal[field]}
                limit={REVEAL_LIMITS[field]}
                value={reveal[field]}
                onChange={(value) => setReveal({ ...reveal, [field]: value })}
              />
            ))}
          </div>
        </details>

        {error && <p className="forge__error">{error}</p>}

        <button className="forge__submit" type="submit" disabled={!canSubmit}>
          {sending ? t.ui.forge.submitSending : edit ? t.ui.forge.submitEdit : t.ui.forge.submit}
        </button>

        <p className="forge__fine">
          {fill(t.ui.forge.fine, { days: maxHorizonDays, retention: retentionDays })}
        </p>

        {!edit && mine.length > 0 && (
          <section className="block">
            <h2 className="block__title">{t.ui.forge.mineTitle}</h2>
            <ul className="mine">
              {mine.map((entry) => (
                <li key={entry.hash}>
                  <a href={entry.adminUrl ?? entry.url}>{entry.title}</a>
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
