# Gender Reveal

A single moment, shared. Everyone who opens the link sees the same countdown
hit zero at the same instant — Buenos Aires, Madrid, or a plane over the
Atlantic — and only then does the page reveal whether it is a girl or a boy.
Guests guess during the countdown; at zero each one is told whether they got it
right, and how many people did.

Built to run entirely on Vercel's free Hobby plan.

---

## How the two hard parts actually work

**One instant, every timezone.** The reveal time is stored as a single ISO-8601
string with an explicit UTC offset (`2026-10-11T20:00:00-03:00`). You pick your
timezone once; `Date.parse` collapses it to one epoch value. There is no DST
arithmetic anywhere in the codebase.

Browsers with a wrong system clock are the real hazard, so `/api/state` returns
`serverNow` on every call. Each client measures its own drift against it and
counts down against the corrected time. A laptop set three hours fast still
hits zero with everybody else.

**The secret stays on the server.** `REVEAL_GENDER` is an environment variable,
never a `NEXT_PUBLIC_` one, never a page prop, never in the client bundle. So is
every word of the reveal copy — the whole `reveal` block of
`content/reveal.config.json` is withheld and the winning phrase is resolved
server-side, so the browser is never handed both options to choose from.
`/api/state` adds `gender`, `correct` and `copy` to its payload only once the
server's own clock has passed the moment. Opening DevTools before then shows
nothing but a countdown.

Votes are rejected with `409` after the hour, for the same reason.

---

## Stack

| Piece | Choice | Why |
| --- | --- | --- |
| Framework | Next.js 15 (App Router) | Zero-config on Vercel; ~106 kB first load |
| Database | Turso (libSQL) | Real SQLite, spoken over HTTP — see below |
| Storage adapter | Port + two adapters | Turso in production, `node:sqlite` file locally |
| Styling | Plain CSS | No framework weight for six components |

### Why not a plain SQLite file

Because it does not work on Vercel, and failing at the reveal is not an option.
Serverless functions get an ephemeral, read-only filesystem — only `/tmp` is
writable, it is per-instance, and it is wiped between invocations. Votes would
vanish, or differ depending on which instance answered.

Turso is the same SQLite, hosted, reachable over HTTP. The free plan is 5 GB,
500M row reads and 10M row writes per month — several orders of magnitude more
than a family event needs. Local development still writes a real `local.db`
file through Node's built-in `node:sqlite`, so `npm run dev` needs no account
and no network.

---

## Setup

```bash
npm install
cp .env.example .env.local
```

Open `.env.local` and set `REVEAL_GENDER` to `girl` or `boy`. Leave the Turso
variables empty for now.

```bash
npm run dev
```

`http://localhost:3000`. Votes land in `local.db` (gitignored).

### Setting the moment

Never write the offset by hand — DST will catch you out. Generate it:

```bash
npm run reveal-at -- "2026-10-11 20:00" "America/Argentina/Buenos_Aires"
```

```
  Zona horaria : America/Argentina/Buenos_Aires
  Hora local   : 2026-10-11 20:00
  revealAt     : 2026-10-11T20:00:00-03:00
  En UTC       : 2026-10-11T23:00:00.000Z
```

Paste the `revealAt` line into `content/reveal.config.json`. The app refuses to
start if the string has no offset, rather than silently guessing.

### Customising the copy

Everything a guest reads lives in `content/reveal.config.json`. Nothing is
hardcoded in a component.

- `countdown` — the pre-reveal page. Shipped to every browser immediately.
- `reveal` — the payoff. **Withheld by the server until the hour**, so anything
  you write here is safe from a curious guest.

`{name}`, `{correct}` and `{total}` are substituted at render time.

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

**2. Push the repo.**

```bash
git init
git add .
git commit -m "feat: gender reveal countdown"
gh repo create gender-reveal --private --source=. --push
```

**3. Import it on Vercel** and add four environment variables under
*Settings → Environment Variables*:

| Name | Value |
| --- | --- |
| `REVEAL_GENDER` | `girl` or `boy` |
| `TURSO_DATABASE_URL` | from step 1 |
| `TURSO_AUTH_TOKEN` | from step 1 |
| `REVEAL_AT` | *optional* — overrides the config file |

Vercel reads environment variables at build time, so **changing one requires a
redeploy** to take effect. Fine for a one-off event; worth knowing at 19:55.

**4. Share the link.** No accounts, no install. The page is `noindex`, so it
will not turn up in a search while you are waiting.

---

## Before the day

- [ ] `REVEAL_GENDER` set on Vercel, and set correctly
- [ ] `revealAt` generated with `npm run reveal-at`, offset included
- [ ] Opened the deployed URL and confirmed the countdown reads what you expect
- [ ] Set your laptop clock two hours off and confirmed the countdown *does not*
      follow it — that is the drift correction doing its job
- [ ] Left a test vote, then cleared `localStorage` before sharing the link

To rehearse the reveal itself, point `REVEAL_AT` at two minutes from now on a
preview deployment. Do not rehearse on production unless you want the answer
out early.

---

## Load

Each open tab polls `/api/state` every 8 seconds, and every 1.2 seconds in the
final stretch. Fifty guests for two hours is roughly 45k function invocations
against Vercel's 1M monthly free allowance, and a rounding error against
Turso's read budget.

There are no websockets — Vercel's free plan has no place to keep a connection
open, and a family-sized guest list does not need one.

## Layout

```
app/
  page.tsx              server shell — hands down the countdown, never the answer
  api/state/route.ts    the single source of truth; releases the secret on time
  api/vote/route.ts     accepts guesses, closes at the hour
components/             Countdown, VotePanel, Reveal, Confetti
lib/
  config.ts             SERVER ONLY — revealAt, REVEAL_GENDER, withheld copy
  messages.ts           the copy that is safe to ship to browsers
  useRevealState.ts     clock-drift correction and polling
  myVote.ts             the guest's own guess, in localStorage
  store/                VoteStore port + Turso and local-file adapters
content/
  reveal.config.json    every word on the site
scripts/
  reveal-at.mjs         wall clock + timezone → ISO with the right offset
```
