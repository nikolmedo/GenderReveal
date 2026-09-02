'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

type Zone = {
  id: string
  city: string
  region: string
  /** Everything this zone can be found by, folded to plain lowercase ASCII. */
  search: string
}

/**
 * `Intl.supportedValuesOf` returns CLDR-canonical ids, and CLDR keeps a lot of
 * cities filed under names nobody uses any more: Kolkata is Asia/Calcutta,
 * Kyiv is Europe/Kiev, Ho Chi Minh is Asia/Saigon. It also drops the
 * `Argentina/` segment from five of the twelve Argentine zones, so Buenos Aires
 * is America/Buenos_Aires and typing "Argentina" finds the other seven only.
 *
 * Listed here as the names people would actually type. The mapping to whatever
 * the browser files them under is resolved by the browser itself, so the day
 * ICU promotes Europe/Kyiv this list keeps working unchanged.
 */
const MODERN_NAMES = [
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Catamarca',
  'America/Argentina/Cordoba',
  'America/Argentina/Jujuy',
  'America/Argentina/Mendoza',
  'America/Indiana/Indianapolis',
  'America/Nuuk',
  'Africa/Asmara',
  'Asia/Ho_Chi_Minh',
  'Asia/Kathmandu',
  'Asia/Kolkata',
  'Asia/Yangon',
  'Atlantic/Faroe',
  'Europe/Kyiv',
]

/** Nicknames and country names no identifier carries. */
const EXTRA_KEYWORDS: Record<string, string> = {
  'America/Buenos_Aires': 'baires caba capital federal',
  'America/Sao_Paulo': 'brasil brazil',
  'America/Mexico_City': 'mexico df cdmx',
  'Europe/Madrid': 'espana spain',
  'America/New_York': 'usa eeuu nueva york',
  'America/Los_Angeles': 'usa eeuu california',
  'Asia/Calcutta': 'india',
  'Europe/Kiev': 'ucrania ukraine',
}

/** What the browser actually files a zone under, or null if it knows it not. */
function canonicalId(id: string): string | null {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: id }).resolvedOptions().timeZone
  } catch {
    return null
  }
}

/** Offered first, because most of the people using this are in one of them. */
const COMMON = [
  'America/Buenos_Aires',
  'America/Montevideo',
  'America/Santiago',
  'America/Sao_Paulo',
  'America/Bogota',
  'America/Lima',
  'America/Mexico_City',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/Madrid',
  'Europe/London',
  'Europe/Rome',
]

const MAX_ROWS = 80

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function cityOf(id: string): string {
  return (id.split('/').pop() ?? id).replace(/_/g, ' ')
}

function regionOf(id: string): string {
  const parts = id.split('/')
  return parts.length > 1 ? parts[0].replace(/_/g, ' ') : ''
}

/**
 * `GMT-03:00`, `GMT+05:45`, read from the zone itself so DST is already applied.
 *
 * Both sides of the subtraction have to be the same shape or the rounding lies.
 * Formatting without seconds while comparing against an epoch that has them
 * leaves the difference short by up to 59.999s, and rounding to minutes then
 * moves a whole minute: -05:00 came out as -05:01 and +02:00 as +01:59.
 */
function offsetLabel(id: string, at: number): string {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone: id,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hourCycle: 'h23',
      })
        .formatToParts(new Date(at))
        .map((part) => [part.type, part.value]),
    )

    const asUtc = Date.UTC(
      Number(parts.year), Number(parts.month) - 1, Number(parts.day),
      Number(parts.hour), Number(parts.minute), Number(parts.second),
    )
    // The zone cannot report milliseconds, so drop them here too.
    const minutes = Math.round((asUtc - Math.floor(at / 1000) * 1000) / 60_000)

    const sign = minutes < 0 ? '-' : '+'
    const abs = Math.abs(minutes)
    const pad = (n: number) => String(n).padStart(2, '0')

    return `GMT${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
  } catch {
    return ''
  }
}

export function TimeZonePicker({
  value,
  onChange,
  label,
}: {
  value: string
  onChange: (zone: string) => void
  label: string
}) {
  const [zones, setZones] = useState<Zone[]>([])
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [now, setNow] = useState(0)

  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  // Built after mount: the browser's zone database is not the one that rendered
  // the HTML, and a list that differs between the two breaks hydration.
  useEffect(() => {
    setNow(Date.now())

    let ids: string[] = []
    try {
      ids = Intl.supportedValuesOf('timeZone')
    } catch {
      ids = []
    }

    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone
    for (const extra of [detected, value]) {
      if (extra && !ids.includes(extra)) ids = [extra, ...ids]
    }

    // Give each zone the name it goes by today, on top of the one it is stored
    // under. The city shown follows the modern spelling too, so the list says
    // Kyiv and Kolkata rather than Kiev and Calcutta.
    const modern = new Map<string, { city: string; words: string }>()
    for (const name of MODERN_NAMES) {
      const canonical = canonicalId(name)
      if (!canonical) continue
      const previous = modern.get(canonical)
      modern.set(canonical, {
        city: cityOf(name),
        words: `${previous?.words ?? ''} ${name.replace(/[/_]/g, ' ')}`,
      })
    }

    setZones(
      ids.map((id) => {
        const city = modern.get(id)?.city ?? cityOf(id)
        return {
          id,
          city,
          region: regionOf(id),
          search: fold(
            `${id} ${cityOf(id)} ${city} ${regionOf(id)} ${modern.get(id)?.words ?? ''} ${EXTRA_KEYWORDS[id] ?? ''}`,
          ),
        }
      }),
    )
    // Only on mount: rebuilding this when `value` changes would be wasted work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const results = useMemo(() => {
    const needle = fold(query.trim())

    if (!needle) {
      const common = COMMON.map((id) => zones.find((z) => z.id === id)).filter(Boolean) as Zone[]
      const rest = zones.filter((z) => !COMMON.includes(z.id))
      return [...common, ...rest].slice(0, MAX_ROWS)
    }

    // A city that starts with what was typed beats one that merely contains it,
    // so "san" offers San Juan before Pago Pago.
    const starts: Zone[] = []
    const contains: Zone[] = []

    for (const zone of zones) {
      if (fold(zone.city).startsWith(needle)) starts.push(zone)
      else if (zone.search.includes(needle)) contains.push(zone)
    }

    return [...starts, ...contains].slice(0, MAX_ROWS)
  }, [zones, query])

  useEffect(() => setActive(0), [query])

  // Close when the click lands anywhere else.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    if (!open) return
    list.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function show() {
    if (open) return
    setQuery('')
    setOpen(true)
  }

  function choose(zone: Zone) {
    onChange(zone.id)
    setOpen(false)
    setQuery('')
    input.current?.blur()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) return show()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + results.length) % Math.max(1, results.length))
      return
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault()
      const picked = results[active]
      if (picked) choose(picked)
      return
    }

    if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setQuery('')
      return
    }

    if (event.key === 'Tab' && open) setOpen(false)
  }

  // Read back from the list, so the closed field spells the city the same way
  // the open list did.
  const selected = zones.find((zone) => zone.id === value)
  const current = value
    ? `${selected?.city ?? cityOf(value)}${now ? ` · ${offsetLabel(value, now)}` : ''}`
    : ''

  return (
    <div className="zone" ref={box}>
      <span className="zone__label" id="zone-label">
        {label}
      </span>

      <div className={`zone__control${open ? ' zone__control--open' : ''}`}>
        <input
          ref={input}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="zone-list"
          aria-labelledby="zone-label"
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `zone-${active}` : undefined}
          autoComplete="off"
          spellCheck={false}
          placeholder="Buscá tu ciudad"
          value={open ? query : current}
          onChange={(event) => {
            setQuery(event.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={show}
          onKeyDown={onKeyDown}
        />

        <button
          type="button"
          className="zone__toggle"
          tabIndex={-1}
          aria-label={open ? 'Cerrar la lista' : 'Ver todas las zonas'}
          onPointerDown={(event) => {
            // Before the input takes focus, so a second click closes instead of
            // reopening what focus just opened.
            event.preventDefault()
            if (open) {
              setOpen(false)
              setQuery('')
            } else {
              show()
              input.current?.focus()
            }
          }}
        >
          <svg viewBox="0 0 12 8" aria-hidden="true">
            <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {open && (
        <ul className="zone__list" id="zone-list" role="listbox" ref={list}>
          {results.length === 0 && <li className="zone__empty">Ninguna zona coincide.</li>}

          {results.map((zone, index) => (
            <li key={zone.id}>
              <button
                type="button"
                id={`zone-${index}`}
                role="option"
                aria-selected={zone.id === value}
                data-active={index === active}
                className={`zone__option${zone.id === value ? ' zone__option--picked' : ''}`}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(zone)}
                onMouseEnter={() => setActive(index)}
              >
                <span className="zone__city">{zone.city}</span>
                <span className="zone__region">{zone.region}</span>
                <span className="zone__offset">{now ? offsetLabel(zone.id, now) : ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
