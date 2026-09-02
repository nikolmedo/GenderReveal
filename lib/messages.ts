import defaults from '@/content/defaults.json'

export type Gender = 'girl' | 'boy'

/** The copy that is safe to ship to every browser from the first byte. */
export type CountdownCopy = typeof defaults.countdown

/** Both possible endings, as the creator wrote them. Server-side only. */
export type RevealTexts = typeof defaults.reveal

/**
 * The ending the server picked, ready to render. `word` arrives already
 * resolved — the browser is never handed both options and asked to choose,
 * because that would mean it held the answer all along.
 */
export type RevealCopy = {
  headline: string
  word: string
  subtitle: string
  correct: string
  wrong: string
  noVote: string
  score: string
  votersShow: string
  votersHide: string
  votersEmpty: string
  votersMore: string
  hostLine: string
}

export const defaultConfig = defaults

/** Fills `{placeholders}` in the configurable copy. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  )
}

/**
 * Field name → maximum length. Doubles as the allow-list: anything a creator
 * submits that is not named here is dropped rather than stored.
 */
export const COUNTDOWN_LIMITS: Record<keyof CountdownCopy, number> = {
  pageTitle: 80,
  eyebrow: 40,
  title: 90,
  welcome: 320,
  hostLine: 90,
  votePrompt: 120,
  nameLabel: 40,
  namePlaceholder: 60,
  voteButton: 40,
  voteButtonSending: 40,
  votedConfirmation: 140,
  voteClosedNotice: 120,
  voteErrorNotice: 140,
  offlineNotice: 140,
  tallyTitle: 60,
  voteSingular: 20,
  votePlural: 20,
  girlLabel: 24,
  boyLabel: 24,
  daysLabel: 16,
  hoursLabel: 16,
  minutesLabel: 16,
  secondsLabel: 16,
}

export const REVEAL_LIMITS: Record<keyof RevealTexts, number> = {
  headline: 40,
  girlText: 60,
  boyText: 60,
  subtitle: 220,
  correct: 140,
  wrong: 140,
  noVote: 160,
  score: 120,
  votersShow: 40,
  votersHide: 40,
  votersEmpty: 120,
  votersMore: 40,
  hostLine: 90,
}
