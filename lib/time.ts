/**
 * Wall-clock time in a named timezone → the single instant it refers to.
 *
 * The creator picks "20:00 in Buenos Aires" once; this collapses it to one
 * epoch value that every visitor counts down to, whatever their own clock says.
 * DST is handled by asking the zone how it reads a candidate instant and
 * correcting, rather than by carrying a table of offsets.
 */

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function resolveInstant(wallClock: string, timeZone: string): number | null {
  const match = wallClock.trim().match(WALL_CLOCK)
  if (!match || !isValidTimeZone(timeZone)) return null

  const [, year, month, day, hour, minute, second = '00'] = match
  const wanted = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)
  if (Number.isNaN(wanted)) return null

  const reader = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23',
  })

  const readBack = (epoch: number) => {
    const parts = Object.fromEntries(reader.formatToParts(new Date(epoch)).map((p) => [p.type, p.value]))
    return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  }

  // Guess UTC, measure how the target zone reads it, correct. Twice, so a
  // correction that itself steps over a DST boundary still settles.
  let instant = wanted
  instant -= readBack(instant) - wanted
  instant -= readBack(instant) - wanted

  return Number.isFinite(instant) ? instant : null
}
