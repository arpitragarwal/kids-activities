# MV Kids

Activity recommender for little kids (0–5) in Mountain View, CA. Pulls events
from the public library, the city's recreation registration system, and a
curated park list, ranks them against weather/age/distance, and refreshes
hourly via cron.

## Stack

- Next.js 15 (App Router) on Vercel
- Postgres via `@vercel/postgres` (works with Neon, Vercel Postgres, Supabase)
- NWS weather API (no key required)
- Vercel Cron for scheduled refresh

## Sources

| Id        | Source                              | Mechanism                                              |
| --------- | ----------------------------------- | ------------------------------------------------------ |
| `library` | Mountain View Public Library        | LibCal iCal feed (`ical_subscribe.php?cid=8800`)       |
| `cityRec` | City of Mountain View Recreation    | ActiveNet REST endpoint (`/rest/activities/list`)      |
| `parks`   | Curated parks & indoor places       | Hardcoded list in `src/lib/sources/parks.ts`           |

When a source breaks, it shows up on `/health` with the last error. Manual
re-run buttons live there too.

## Running locally

1. Spin up a free Postgres (Neon: <https://neon.tech>). Copy the connection
   string.

2. ```bash
   cp .env.example .env.local
   # paste POSTGRES_URL, optionally generate CRON_SECRET
   npm install
   npm run dev
   ```

3. The first page load creates tables. Trigger an initial refresh:
   ```bash
   POSTGRES_URL='...' npm run refresh:local
   ```
   or hit <http://localhost:3000/api/refresh> in a browser.

## Deploying to Vercel

1. `vercel link` (or push to GitHub and import in the dashboard).
2. Add env vars: `POSTGRES_URL` (auto-set if you attach Vercel Postgres) and
   `CRON_SECRET` (generate with `openssl rand -hex 32`).
3. Deploy. The `vercel.json` registers `/api/refresh` as an hourly cron — Vercel
   automatically attaches `Authorization: Bearer $CRON_SECRET`.
4. Visit `/health` after the first cron run to verify all sources are green.

## Configuration

Edit `src/lib/config.ts` (or set env vars):

- `CHILD_AGE_MONTHS` — age in months (default 36)
- `HOME_LAT`, `HOME_LNG` — home coordinates for distance ranking
- `maxDistanceMiles` — soft cap; events farther get a penalty (in `config.ts`)

## Adding a source

1. Create `src/lib/sources/<name>.ts` exporting a `SourceDefinition`.
2. Add it to the `SOURCES` array in `src/lib/sources/index.ts`.
3. Trigger a refresh — `/health` will show its status.

A source's `fetch()` should normalize to `NormalizedEvent[]`. Throw on
fetch/parse failure — the registry records the error and the next run will
retry.

## Ranking

`src/lib/rank.ts` produces a score per event from these signals:

- **Age fit** — bonus when child age in months falls inside the event's range
- **Distance** — bonus for ≤1mi, penalty beyond `maxDistanceMiles`
- **Weather** — outdoor events boosted on nice days, indoor when wet/hot/cold
- **Time of day** — boost for "happening now" or "starts soon"; penalty during
  the toddler nap window (12–2pm) for kids under 3
- **Evergreen vs scheduled** — parks always rank against the asking hour's
  weather

Each event surfaces its reasons as chips in the UI so you can see why it
ranked where it did.

## Caveats

- LibCal iCal feed mixes adult, teen, and kids events — we filter on
  category/keyword. The filter is intentionally conservative: a few real kids
  events may get dropped, which is preferable to surfacing adult ESL classes.
- ActiveNet activities are series, not one-off events. They show as
  "evergreen" while their series window is active.
- The MV city site (`mountainview.gov`) is firewalled by Akamai and can't be
  scraped reliably, so we go directly to the registration platform behind it.
