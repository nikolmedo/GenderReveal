'use client'

import type { CountdownCopy } from '@/lib/messages'

function split(remainingMs: number, copy: CountdownCopy) {
  const total = Math.max(0, Math.floor(remainingMs / 1000))

  return [
    { value: Math.floor(total / 86400), label: copy.daysLabel },
    { value: Math.floor(total / 3600) % 24, label: copy.hoursLabel },
    { value: Math.floor(total / 60) % 60, label: copy.minutesLabel },
    { value: total % 60, label: copy.secondsLabel },
  ]
}

export function Countdown({
  remainingMs,
  copy,
  ready,
}: {
  remainingMs: number
  copy: CountdownCopy
  ready: boolean
}) {
  const finalMinute = remainingMs > 0 && remainingMs <= 60_000

  return (
    <section
      className={`clock${ready ? '' : ' clock--waiting'}${finalMinute ? ' clock--imminent' : ''}`}
      aria-label="Cuenta regresiva"
    >
      {split(remainingMs, copy).map((unit, index) => (
        // Cards alternate pink and blue so neither colour leads before the hour.
        <div className={`card card--${index % 2 === 0 ? 'girl' : 'boy'}`} key={unit.label}>
          <div className="card__digits">
            {String(unit.value)
              .padStart(2, '0')
              .split('')
              .map((digit, position) => (
                <span className="card__digit" key={`${unit.label}-${position}`}>
                  {digit}
                </span>
              ))}
          </div>
          <span className="card__label">{unit.label}</span>
        </div>
      ))}
    </section>
  )
}
