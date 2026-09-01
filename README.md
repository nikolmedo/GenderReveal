# Gender Reveal

Fill in a form, get a link, send it to everyone you know. When the clock hits
zero it hits zero for all of them at once — Buenos Aires, Madrid, a plane over
the Atlantic — and only then does the page say whether it is a girl or a boy.
Guests guess during the countdown; at zero each one is told whether they got it
right, and how many people did.

Any number of countdowns can run at the same time, each behind its own link.
Built to run entirely on Vercel's free Hobby plan.

---

## How the hard parts actually work

**One instant, every timezone.** The creator picks a wall-clock time and a
timezone. The server collapses that to a single epoch value by asking the zone
how it reads a candidate instant and correcting — twice, so a correction that
itself steps over a DST boundary still settles. There is no table of offsets
anywhere in the codebase, and no DST arithmetic.

Browsers with a wrong system clock are the real hazard, so the state endpoint
returns `serverNow` on every call. Each client measures its own drift against
it and counts down against the corrected time. A laptop set three hours fast
still hits zero with everybody else.

**The secret stays on the server.** The gender lives in a database column. So
does every word of the reveal copy — the whole `reveal` section of a countdown's
configuration is withheld, and the winning phrase is resolved server-side, so
the browser is never handed both options to choose from. `/api/reveals/[hash]/state`
adds `gender`, `correct`, `copy` and the sky tint to its payload only once the
server's own clock has passed that countdown's moment. Opening DevTools before
then shows nothing but a countdown. Votes are rejected with `409` after the
hour, for the same reason.

Each countdown closes on **its own** instant. Two can be open at once and shut
hours apart.

**The palette is derived on the server.** A creator picks two colours; the
server derives light, deep, pale and three sky-tint shades from each, and the
page wears all eight as inline custom properties. Not `color-mix` in CSS: a
custom property substitutes its `var()` references at the element where it is
*declared*, so tokens derived in `:root` would ignore an override further down
the tree — and older Safari has no `color-mix` at all.

Colours are validated as strict `#rrggbb` before they are stored. They are
written into a `style` attribute, so anything looser than that is a CSS
injection.

---

## Rules

| Rule | Value | Where it is enforced |
| --- | --- | --- |
| Maximum countdown length | 45 days | Rejected at creation, `horizon_exceeded` |
| Retention after the reveal | 30 days | `expires_at`, then purged |
| Reveal in the past | Rejected | `time_in_past` |

Retention is enforced twice: opportunistically on every creation, and by a
daily Vercel Cron hitting `/api/cron/purge`. A countdown past its window
returns 404 the moment it expires, whether or not the sweep has run yet — the
data is unreachable immediately and deleted shortly after.

---

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Zero-config on Vercel; ~107 kB first load |
| Database | Turso (libSQL) | Real SQLite, spoken over HTTP — see below |
| Storage adapter | Port + two adapters | Turso in production, `node:sqlite` file locally |
| Styling | Plain CSS | Balloons and confetti are transforms, not a library |

### Why not a plain SQLite file

Because it does not work on Vercel, and failing at the reveal is not an option.
Serverless functions get an ephemeral, read-only filesystem — only `/tmp` is
writable, it is per-instance, and it is wiped between invocations. Countdowns
and votes would vanish, or differ depending on which instance answered.

Turso is the same SQLite, hosted, reachable over HTTP. The free plan is 5 GB,
500M row reads and 10M row writes per month — several orders of magnitude more
than this needs. Local development still writes a real `local.db` file through
Node's built-in `node:sqlite`, so `npm run dev` needs no account and no network.

---

## Setup

```bash
npm install
npm run dev
```

`http://localhost:3000` is the configurator. Create a countdown and it hands
you a link. Everything lands in `local.db` (gitignored); no account, no
network, no environment variables needed to develop.

### Customising the defaults

`content/defaults.json` is what prefills the form: the two colours, every line
of countdown copy and every line of reveal copy. Change it and the form starts
from your wording instead. Nothing is hardcoded in a component.

Its two sections mirror the security boundary:

- `countdown` — the pre-reveal page. Shipped to every browser immediately.
- `reveal` — the payoff. **Withheld by the server until the hour**, so anything
  written here is safe from a curious guest.

`{name}`, `{correct}` and `{total}` are substituted at render time. Each field
has its own length limit in `lib/messages.ts`; that table doubles as the
allow-list, so anything a creator submits that is not named there is dropped
rather than stored.

---

## Deploying to Vercel

**1. Create the Turso database.** Sign up at [turso.tech](https://turso.tech),
then:

```bash
turso db create gender-reveal
turso db show gender-reveal --url          # → TURSO_DATABASE_URL
turso db tokens create gender-reveal       # → TURSO_AUTH_TOKEN
```

The schema creates itself on the first request; there is no migration step.

**2. Import the repo on Vercel** and add these environment variables under
*Settings → Environment Variables*:

| Name | Required | Value |
| --- | --- | --- |
| `TURSO_DATABASE_URL` | yes | from step 1 |
| `TURSO_AUTH_TOKEN` | yes | from step 1 |
| `CRON_SECRET` | for the daily purge | any long random string |

`vercel.json` registers the daily cron; Vercel sends `CRON_SECRET` as a bearer
token, and the endpoint refuses anything else.

**3. Share a link.** No accounts, no install for guests. Reveal pages are
`noindex`, so a countdown will not turn up in a search while you are waiting.

---

## Before the day

- [ ] Created the countdown on the deployed site, not on localhost
- [ ] Opened the link and confirmed the countdown reads what you expect
- [ ] Set your laptop clock two hours off and confirmed the countdown *does not*
      follow it — that is the drift correction doing its job
- [ ] Left a test vote, then cleared `localStorage` before sharing the link
- [ ] Kept the link somewhere other than the browser that made it

The configurator remembers what you created in that browser's `localStorage`
and lists it under the form. That is a convenience, not a backup: there is no
account and no recovery. **Save the link.**

To rehearse the whole thing, create a throwaway countdown two minutes out and
watch it fire. It costs nothing and it is the only way to see the real
transition before the real one.

---

## Load

Each open tab polls the state endpoint every 8 seconds, and every 1.2 seconds
in the final stretch. Fifty guests for two hours is roughly 45k function
invocations against Vercel's 1M monthly free allowance, and a rounding error
against Turso's read budget.

There are no websockets — Vercel's free plan has no place to keep a connection
open, and a family-sized guest list does not need one.

Anyone who can reach the site can create a countdown. Payload size and every
field are capped, which is the right amount of defence for something this
size; there is no rate limiting. If it ever gets shared beyond the people you
meant to share it with, that is the thing to add.

---

## Layout

```
app/
  page.tsx                        the configurator
  r/[hash]/page.tsx               a countdown — hands down its palette, never the answer
  api/reveals/route.ts            POST: validate, derive, store, hand back a link
  api/reveals/[hash]/state        the single source of truth; releases the secret on time
  api/reveals/[hash]/vote         accepts guesses, closes at that countdown's hour
  api/cron/purge                  daily retention sweep
components/
  Configurator.tsx                the form
  Balloons.tsx                    lives above the countdown/reveal swap, so the moment is continuous
  Countdown, VotePanel, Reveal, Confetti
lib/
  reveals.ts                      validation, hashes, retention, the withheld copy
  palette.ts                      two colours → the whole theme
  time.ts                         wall clock + IANA zone → one instant
  messages.ts                     the copy that is safe to ship, and every field limit
  useRevealState.ts               clock-drift correction and polling
  myVote.ts                       the guest's own guess, in localStorage, keyed per countdown
  store/                          RevealStore port + Turso and local-file adapters
content/
  defaults.json                   what the form starts from
```
