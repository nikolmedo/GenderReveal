/**
 * Turns a wall-clock time in a named timezone into the ISO-8601 string with the
 * correct UTC offset for that exact date — including whatever DST rule applies.
 *
 *   npm run reveal-at -- "2026-10-11 20:00" "America/Argentina/Buenos_Aires"
 */

const [when, timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone] = process.argv.slice(2)

if (!when) {
  console.error('Uso: npm run reveal-at -- "2026-10-11 20:00" "America/Argentina/Buenos_Aires"')
  process.exit(1)
}

const match = when.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)

if (!match) {
  console.error('Formato esperado: "YYYY-MM-DD HH:mm"')
  process.exit(1)
}

const [, year, month, day, hour, minute, second = '00'] = match
const wallClock = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second)

const reader = new Intl.DateTimeFormat('en-US', {
  timeZone,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
  hourCycle: 'h23',
})

function readAsWallClock(epoch) {
  const p = Object.fromEntries(reader.formatToParts(new Date(epoch)).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second)
}

// Guess UTC, measure how the target zone reads that instant, correct. Twice,
// so a correction that itself steps over a DST boundary still settles.
let instant = wallClock
instant -= readAsWallClock(instant) - wallClock
instant -= readAsWallClock(instant) - wallClock

const offsetMinutes = Math.round((wallClock - instant) / 60000)
const pad = (n) => String(Math.floor(n)).padStart(2, '0')
const sign = offsetMinutes >= 0 ? '+' : '-'
const offset = `${sign}${pad(Math.abs(offsetMinutes) / 60)}:${pad(Math.abs(offsetMinutes) % 60)}`

console.log(`
  Zona horaria : ${timeZone}
  Hora local   : ${when}
  revealAt     : ${year}-${month}-${day}T${hour}:${minute}:${second}${offset}
  En UTC       : ${new Date(instant).toISOString()}

  Pegalo en content/reveal.config.json -> "revealAt"
`)
