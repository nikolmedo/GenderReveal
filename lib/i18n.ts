import en from '@/content/copy/en.json'
import es from '@/content/copy/es.json'

export const LOCALES = ['en', 'es'] as const

export type Locale = (typeof LOCALES)[number]

/** English unless something says otherwise. */
export const DEFAULT_LOCALE: Locale = 'en'

/**
 * Countdowns stored before this file existed have no locale, and every one of
 * them was written in Spanish. Only `hydrate` uses this; a countdown created
 * from now on with nothing specified is English.
 */
export const LEGACY_LOCALE: Locale = 'es'

export type Copy = typeof en

// The annotation is the check: a key missing from es.json fails the build
// rather than rendering as undefined on somebody's party page.
const CATALOG: Record<Locale, Copy> = { en, es }

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value)
}

export function copyFor(locale: Locale): Copy {
  return CATALOG[locale]
}

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
}

/**
 * Best match for an Accept-Language header, English when nothing fits.
 *
 * Only the primary subtag matters here: `es-AR`, `es-419` and plain `es` all
 * mean the same thing to this app.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE

  const ranked = acceptLanguage
    .split(',')
    .map((part) => {
      const [tag, ...rest] = part.trim().split(';')
      const q = rest.find((r) => r.trim().startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q.split('=')[1]) : 1 }
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q)

  for (const { tag } of ranked) {
    const primary = tag.split('-')[0]
    if (isLocale(primary)) return primary
  }

  return DEFAULT_LOCALE
}
