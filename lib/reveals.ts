import { derivePalette, isHexColor, type Palette } from '@/lib/palette'
import {
  COUNTDOWN_LIMITS,
  REVEAL_LIMITS,
  defaultConfig,
  type CountdownCopy,
  type Gender,
  type RevealCopy,
  type RevealTexts,
} from '@/lib/messages'
import { revealStore } from '@/lib/store'
import type { RevealRow } from '@/lib/store/types'
import { isValidTimeZone, resolveInstant } from '@/lib/time'
import { copyFor, DEFAULT_LOCALE, isLocale, LEGACY_LOCALE, type Locale } from '@/lib/i18n'

/** How far ahead a countdown may be set. */
export const MAX_HORIZON_DAYS = 45

/** How long a finished reveal and its votes are kept before being purged. */
export const RETENTION_DAYS = 30

const DAY_MS = 86_400_000
const HASH_LENGTH = 12
const ADMIN_HASH_LENGTH = 20

// No 0/1/l/o: these links get read aloud and retyped from phone screens.
const HASH_ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789'

export type RevealOptions = {
  votingEnabled: boolean
  showVoters: boolean
}

export type StoredConfig = {
  countdown: CountdownCopy
  reveal: RevealTexts
  colors: { girl: string; boy: string }
  options: RevealOptions
  /** Fixed when the link is made. A countdown speaks one language forever. */
  locale: Locale
  timeZone: string
  wallClock: string
}

export type LoadedReveal = {
  hash: string
  adminHash: string | null
  gender: Gender
  revealAt: number
  expiresAt: number
  config: StoredConfig
  palette: Palette
}

export type CreateFailure =
  | 'invalid_payload'
  | 'invalid_gender'
  | 'invalid_time'
  | 'time_in_past'
  | 'horizon_exceeded'
  | 'invalid_color'
  | 'invalid_text'
  | 'collision'

export type CreateResult =
  | { ok: true; hash: string; adminHash: string; revealAt: number; expiresAt: number }
  | { ok: false; error: CreateFailure }

export type UpdateFailure = CreateFailure | 'not_found' | 'already_revealed'

export type UpdateResult = { ok: true; revealAt: number; expiresAt: number } | { ok: false; error: UpdateFailure }

function randomHash(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => HASH_ALPHABET[b % HASH_ALPHABET.length]).join('')
}

export function newHash(): string {
  return randomHash(HASH_LENGTH)
}

/** Longer than the public one: this link is the keys to the countdown. */
export function newAdminHash(): string {
  return randomHash(ADMIN_HASH_LENGTH)
}

export function isHash(value: unknown): value is string {
  return typeof value === 'string' && new RegExp(`^[${HASH_ALPHABET}]{${HASH_LENGTH}}$`).test(value)
}

export function isAdminHash(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    new RegExp(`^[${HASH_ALPHABET}]{${ADMIN_HASH_LENGTH}}$`).test(value)
  )
}

/**
 * Absent means on.
 *
 * Anything looser here would read every countdown made before these options
 * existed as "voting disabled", which is the opposite of what its organiser
 * chose. Only an explicit `false` turns something off.
 */
function cleanOptions(input: unknown): RevealOptions {
  const source = (input ?? {}) as Record<string, unknown>

  return {
    votingEnabled: source.votingEnabled !== false,
    showVoters: source.showVoters !== false,
  }
}

/**
 * Copies only the fields the app knows about, each within its own limit.
 * Anything else a creator sends is dropped rather than stored — the limits
 * table is the allow-list, not just a length check.
 */
function cleanCopy<T extends Record<string, string>>(
  input: unknown,
  limits: Record<keyof T, number>,
  fallback: T,
): T | null {
  if (typeof input !== 'object' || input === null) return null

  const source = input as Record<string, unknown>
  const out = {} as Record<string, string>

  for (const [field, limit] of Object.entries(limits) as Array<[string, number]>) {
    const raw = source[field]

    if (raw === undefined || raw === null || raw === '') {
      out[field] = fallback[field as keyof T]
      continue
    }

    if (typeof raw !== 'string') return null

    const value = raw.replace(/\s+/g, ' ').trim()
    if (value.length === 0) {
      out[field] = fallback[field as keyof T]
      continue
    }
    if (value.length > limit) return null

    out[field] = value
  }

  return out as T
}

export function validate(body: unknown): { config: StoredConfig; gender: Gender; revealAt: number } | CreateFailure {
  if (typeof body !== 'object' || body === null) return 'invalid_payload'
  const input = body as Record<string, unknown>

  const gender = input.gender
  if (gender !== 'girl' && gender !== 'boy') return 'invalid_gender'

  const wallClock = typeof input.wallClock === 'string' ? input.wallClock.trim() : ''
  const timeZone = typeof input.timeZone === 'string' ? input.timeZone.trim() : ''
  if (!wallClock || !timeZone || !isValidTimeZone(timeZone)) return 'invalid_time'

  const revealAt = resolveInstant(wallClock, timeZone)
  if (revealAt === null) return 'invalid_time'

  const now = Date.now()
  if (revealAt <= now) return 'time_in_past'
  if (revealAt - now > MAX_HORIZON_DAYS * DAY_MS) return 'horizon_exceeded'

  // Strict hex only. These values are written straight into a style attribute,
  // so anything looser than this is a CSS injection.
  const colors = (input.colors ?? {}) as Record<string, unknown>
  const girlColor = colors.girl ?? defaultConfig.colors.girl
  const boyColor = colors.boy ?? defaultConfig.colors.boy
  if (!isHexColor(girlColor) || !isHexColor(boyColor)) return 'invalid_color'

  // Anything the creator left blank falls back to the wording of the language
  // they were looking at, not to whichever one happens to be the default.
  const locale = isLocale(input.locale) ? input.locale : DEFAULT_LOCALE
  const fallback = copyFor(locale)

  const countdown = cleanCopy(input.countdown ?? {}, COUNTDOWN_LIMITS, fallback.countdown)
  const reveal = cleanCopy(input.reveal ?? {}, REVEAL_LIMITS, fallback.reveal)
  if (!countdown || !reveal) return 'invalid_text'

  return {
    gender,
    revealAt,
    config: {
      countdown,
      reveal,
      colors: { girl: girlColor, boy: boyColor },
      options: cleanOptions(input.options),
      locale,
      timeZone,
      wallClock,
    },
  }
}

export async function createReveal(body: unknown): Promise<CreateResult> {
  const parsed = validate(body)
  if (typeof parsed === 'string') return { ok: false, error: parsed }

  const store = await revealStore()

  // Opportunistic cleanup: retention is enforced here on every creation as
  // well as by the daily cron, so the data goes even if the cron never runs.
  await store.purgeExpired(Date.now()).catch(() => 0)

  const expiresAt = parsed.revealAt + RETENTION_DAYS * DAY_MS
  const serialised = JSON.stringify(parsed.config)

  for (let attempt = 0; attempt < 2; attempt++) {
    // Both are unique keys, so both have to be redrawn on a retry.
    const hash = newHash()
    const adminHash = newAdminHash()
    try {
      await store.createReveal({
        hash,
        adminHash,
        gender: parsed.gender,
        revealAt: parsed.revealAt,
        expiresAt,
        config: serialised,
      })
      return { ok: true, hash, adminHash, revealAt: parsed.revealAt, expiresAt }
    } catch {
      // Almost certainly a key collision; one retry is plenty at 32^12
      // possible public hashes and 32^20 admin ones.
    }
  }

  return { ok: false, error: 'collision' }
}

/**
 * One place where a stored row becomes something the app can render, so the
 * public lookup and the organiser's cannot drift on retention or on defaults.
 */
function hydrate(row: RevealRow | null, now: number): LoadedReveal | null {
  if (!row || row.expiresAt < now) return null

  const stored = JSON.parse(row.config) as StoredConfig

  // Every countdown stored before locales existed was written in Spanish, so
  // that is what a missing one means here. New ones default to English instead;
  // the two are different questions with different right answers.
  const locale = isLocale(stored.locale) ? stored.locale : LEGACY_LOCALE
  const fallback = copyFor(locale)

  // A countdown stored before a field existed simply has no value for it. Fill
  // the gaps from its own language rather than rendering a blank button at the
  // one moment the whole thing is for.
  const config: StoredConfig = {
    ...stored,
    countdown: { ...fallback.countdown, ...stored.countdown },
    reveal: { ...fallback.reveal, ...stored.reveal },
    options: cleanOptions(stored.options),
    locale,
  }

  return {
    hash: row.hash,
    adminHash: row.adminHash,
    gender: row.gender,
    revealAt: row.revealAt,
    expiresAt: row.expiresAt,
    config,
    palette: derivePalette(config.colors.girl, config.colors.boy),
  }
}

/** Returns null for a hash that never existed or has passed its retention window. */
export async function loadReveal(hash: string, now = Date.now()): Promise<LoadedReveal | null> {
  if (!isHash(hash)) return null

  const store = await revealStore()
  return hydrate(await store.getReveal(hash), now)
}

/** The same, reached through the organiser's private token. */
export async function loadRevealByAdmin(
  adminHash: string,
  now = Date.now(),
): Promise<LoadedReveal | null> {
  if (!isAdminHash(adminHash)) return null

  const store = await revealStore()
  return hydrate(await store.getRevealByAdmin(adminHash), now)
}

/**
 * Rewrites a countdown through the organiser's link. Runs the very same
 * validation as creation: a lighter path here would reopen the colour
 * injection that the strict hex check closes.
 */
export async function updateReveal(adminHash: string, body: unknown): Promise<UpdateResult> {
  if (!isAdminHash(adminHash)) return { ok: false, error: 'not_found' }

  const now = Date.now()
  const existing = await loadRevealByAdmin(adminHash, now)
  if (!existing) return { ok: false, error: 'not_found' }

  // Once the envelope is open there is nothing left to configure, and rewriting
  // the copy would change what guests are looking at right now.
  if (now >= existing.revealAt) return { ok: false, error: 'already_revealed' }

  // The gender and the language are both fixed at creation. Without pinning
  // them here, an edit that simply does not mention the locale would silently
  // flip somebody's Spanish countdown into English.
  const parsed = validate({
    ...(body as object),
    gender: existing.gender,
    locale: existing.config.locale,
  })
  if (typeof parsed === 'string') return { ok: false, error: parsed }

  const expiresAt = parsed.revealAt + RETENTION_DAYS * DAY_MS
  const store = await revealStore()
  await store.updateReveal(adminHash, parsed.revealAt, expiresAt, JSON.stringify(parsed.config))

  return { ok: true, revealAt: parsed.revealAt, expiresAt }
}

/** Resolves the withheld copy for one gender. Only ever called after the hour. */
export function revealCopy(texts: RevealTexts, gender: Gender): RevealCopy {
  return {
    headline: texts.headline,
    word: gender === 'girl' ? texts.girlText : texts.boyText,
    subtitle: texts.subtitle,
    correct: texts.correct,
    wrong: texts.wrong,
    noVote: texts.noVote,
    score: texts.score,
    votersShow: texts.votersShow,
    votersHide: texts.votersHide,
    votersEmpty: texts.votersEmpty,
    votersMore: texts.votersMore,
    hostLine: texts.hostLine,
  }
}
