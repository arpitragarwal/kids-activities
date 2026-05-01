# MV Kids

Activity recommender for young kids in Mountain View, CA and nearby cities.
Pulls events from city recreation systems, public libraries, and a curated
park list, ranks them against weather/age/distance, and refreshes hourly via cron.

## Stack

- Next.js 15 (App Router) on Vercel
- Postgres via `@neondatabase/serverless` (Neon, Vercel Postgres, or Supabase)
- NWS weather API (no key required)
- Vercel Cron for scheduled refresh

## Sources

| Id | Source | Mechanism |
|----|--------|-----------|
| `library` | Mountain View Public Library | LibCal iCal feed (`ical_subscribe.php?cid=8800`) |
| `paloAltoLibrary` | Palo Alto City Library | BiblioCommons RSS (`gateway.bibliocommons.com/v2/libraries/paloalto/rss/events`) |
| `scclLibrary` | Santa Clara County Library (Cupertino + Los Altos branches) | BiblioCommons RSS, filtered by branch |
| `cityRec` | City of Mountain View Recreation | ActiveNet REST API (`mountainviewrecreation`) |
| `santaClaraRec` | City of Santa Clara Recreation | ActiveNet REST API (`santaclara`) |
| `cupertinoRec` | City of Cupertino Recreation | ActiveNet REST API (`cupertino`) |
| `parks` | Curated parks & indoor places | Hardcoded list in `src/lib/sources/parks.ts` |

When a source breaks it shows up on `/health` with the last error.

### Sources not yet integrated

| City | System | Blocker |
|------|--------|---------|
| Sunnyvale Parks & Rec | Unknown (not ActiveNet) | City website blocked by Akamai CDN |
| Palo Alto Parks & Rec | Unknown | City website returns 403 |
| Los Altos Parks & Rec | Rec1 (`secure.rec1.com`) | Server-rendered SPA, no public API |
| Sunnyvale Public Library | LibCal | Calendar ID (cid) requires auth to discover |
| Santa Clara City Library | Unknown | All endpoints return 403 |

## Running locally

1. Spin up a free Postgres (Neon: <https://neon.tech>). Copy the connection string.

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

User preferences are stored in the database and editable via the settings drawer
in the app. Defaults can be set in `src/lib/config.ts` or via env vars:

- `CHILD_AGE_MONTHS` — age in months (default 36)
- `HOME_LAT`, `HOME_LNG` — home coordinates for distance ranking
- `maxDistanceMiles` — soft cap; events farther get a penalty (in `config.ts`)

## Adding a source

**ActiveNet (city recreation):** add a new entry to `makeCityRecSource()` callers
in `src/lib/sources/cityRec.ts` — just supply the slug and venue coords.

**BiblioCommons (library):** add a new `makeBiblioCommonsSource()` call in
`src/lib/sources/bibliocommons.ts` — supply the domain slug and optionally a
`branchFilter` to restrict to specific library branches.

**Other:** create `src/lib/sources/<name>.ts` exporting a `SourceDefinition`,
then add it to `SOURCES` in `src/lib/sources/index.ts`.

A source's `fetch()` should normalize to `NormalizedEvent[]`. Throw on failure —
the registry records the error and the next run will retry.

## UI

- **Week strip** — 7-day tab bar at the top; today is selected by default
- **Filter chips** — Indoor / Outdoor / Free / Drop-in (AND logic)
- **Map view** — Leaflet + OpenStreetMap; toggle per day; pins colored by indoor/outdoor
- **Top picks** — up to 3 events, diversified across source × indoorness buckets
- **Context header** — date, time, weather summary, child age/location profile

## Ranking

`src/lib/rank.ts` scores each event:

- **Age fit** — bonus when child age falls inside the event's range
- **Distance** — bonus for ≤1 mi, penalty beyond `maxDistanceMiles`
- **Weather** — outdoor events boosted on nice days, indoor when wet/hot/cold
- **Time of day** — boost for "happening now" or "starts soon"; penalty during
  nap window (12–2 pm) for kids under 3
- **Evergreen vs scheduled** — parks always rank against the current weather

Score reasons surface as chips on each event card.

## Caveats

- BiblioCommons and LibCal feeds mix all-ages events — we filter on audience
  category labels. A few edge-case kids events may be dropped; that's preferable
  to surfacing adult ESL or senior programs.
- ActiveNet activities are series, not one-off events. They show as "evergreen"
  while their series date window is active.
- City rec websites (MV, SC, Cupertino) are behind Akamai and can't be scraped
  directly — we call the ActiveNet API behind them instead.
