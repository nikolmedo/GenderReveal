import raw from '@/content/reveal.config.json'

export type Gender = 'girl' | 'boy'

/** The copy that is safe to ship to every browser from the first byte. */
export type CountdownCopy = typeof raw.countdown

/**
 * The copy the server resolves and releases only once the moment has passed.
 * `word` arrives already chosen — the browser is never handed both options and
 * asked to pick, because that would mean it held the answer all along.
 */
export type RevealCopy = {
  headline: string
  word: string
  subtitle: string
  correct: string
  wrong: string
  noVote: string
  score: string
  hostLine: string
}

export const countdownCopy: CountdownCopy = raw.countdown

/** Fills `{placeholders}` in the configurable copy. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? String(values[key]) : match,
  )
}
