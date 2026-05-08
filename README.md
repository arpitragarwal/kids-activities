# Kids Activities Near You

Activity recommender for young kids in the Bay Area.
Pulls events from city recreation systems, public libraries, Music Together centers, and a curated
park list, ranks them against weather/age/distance, and refreshes hourly via cron.

## Stack

- Next.js 15 (App Router) on Vercel
- Postgres via `@neondatabase/serverless` (Neon, Vercel Postgres, or Supabase)
- NWS weather API (no key required)
- Vercel Cron for scheduled refresh

## Sources

### City Recreation (ActiveNet REST API)

| Id | Source |
|----|--------|
| `cityRec` | City of Mountain View Recreation |
| `santaClaraRec` | City of Santa Clara Recreation |
| `cupertinoRec` | City of Cupertino Recreation |
| `sanJoseRec` | City of San Jose Recreation |
| `sfRec` | SF Recreation & Parks |
| `fremontRec` | City of Fremont Recreation |
| `milpitasRec` | City of Milpitas Recreation |
| `redwoodCityRec` | City of Redwood City Recreation |
| `dalyCityRec` | City of Daly City Recreation |
| `sunnyvaleRec` | City of Sunnyvale Recreation |

### Libraries — LibCal iCal feed

| Id | Source |
|----|--------|
| `library` | Mountain View Public Library |
| `sunnyvaleLibrary` | Sunnyvale Public Library |
| `losGatosLibrary` | Los Gatos Public Library |
| `sanMateoPublicLibraryKids` | San Mateo Public Library (kids calendar) |
| `sanMateoPublicLibrary` | San Mateo Public Library (teens/adults calendar — family events extracted) |

### Libraries — BiblioCommons RSS

| Id | Source |
|----|--------|
| `paloAltoLibrary` | Palo Alto City Library |
| `scclLibrary` | Santa Clara County Library (Cupertino + Los Altos branches) |
| `sanJoseLibrary` | San Jose Public Library |
| `alamedaCountyLibrary` | Alameda County Library |
| `sanMateoCountyLibrary` | San Mateo County Library |

### Other

| Id | Source | Mechanism |
|----|--------|-----------|
| `parks` | Curated parks & indoor places | Hardcoded list in `src/lib/sources/parks.ts` |
| `music-together` | Music Together (Bay Area centers) | Scrapes `calendar.aspx` from each center's Main Street Sites page; falls back to evergreen for centers without a calendar |
| `santaClaraLibrary` | Santa Clara City Library | Scrapes server-rendered HTML calendar at `sclibrary.org`; may return 403 on non-Vercel IPs |

When a source breaks it shows up on `/health` with the last error.

### Sources not yet integrated

| Source | System | Blocker |
|--------|--------|---------|
| Los Altos Parks & Rec | Rec1 (`secure.rec1.com`) | Server-rendered SPA, no public API |
| Campbell Parks & Rec | Rec1 (`secure.rec1.com`) | Server-rendered SPA, no public API |
| South San Francisco Rec | Rec1 (`secure.rec1.com`) | Server-rendered SPA, no public API |
| San Mateo City Rec | WebTrac (`casanmateoweb.myvscloud.com`) | Proprietary platform, 403 on direct API hits |
| Menlo Park Rec | eGovLink (`secure.egovlink.com/menlopark`) | Proprietary platform, no public API |
| Newark Rec | ActivityReg (`newarkca.activityreg.com`) | Proprietary platform, no public API |
| Los Gatos Rec | PerfectMind (`losgatos.perfectmind.com`) | Proprietary SaaS, no public API |
| Daly City Library | LibCal (`dalycity.libcal.com`) | LibCal instance has 0 events (only an unused "Online Events" calendar) |
| Menlo Park Library | Granicus CMS | JavaScript-rendered SPA, no structured events feed |
| Redwood City Library | City CMS | No structured events feed |

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

**LibCal (library):** add a new config entry in `src/lib/sources/library.ts` —
supply the `cid` (calendar ID, found in the iCal subscribe URL on the library's events page).

**BiblioCommons (library):** add a new `makeBiblioCommonsSource()` call in
`src/lib/sources/bibliocommons.ts` — supply the domain slug and optionally a
`branchFilter` to restrict to specific library branches.

**Music Together:** centers are auto-discovered from the MT locator API within 30 miles
of Mountain View. Centers using the Main Street Sites `calendar.aspx` platform are
scraped for real class times; others fall back to an evergreen card. To add a center
that isn't in the MT API, add it to `STATIC_CENTERS` in `src/lib/sources/musicTogether.ts`.

**Other:** create `src/lib/sources/<name>.ts` exporting a `SourceDefinition`,
then add it to `SOURCES` in `src/lib/sources/index.ts`.

A source's `fetch()` should normalize to `NormalizedEvent[]`. Throw on failure —
the registry records the error and the next run will retry.

## UI

- **Week strip** — 7-day tab bar with weather icon + temp range per day
- **Filter bar** — Location / Cost / Sign-up / Time / Distance (AND logic, dropdown pills)
- **Map view** — Leaflet + OpenStreetMap; toggle per day; pins colored by indoor/outdoor
- **Top picks** — personalized for child's age, diversified across source × indoorness buckets
- **Context header** — date, weather summary, child age/home profile with inline edit drawer

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
- City rec websites are behind Akamai and can't be scraped directly — we call
  the ActiveNet REST API behind them instead.
- Music Together class times are scraped from center websites and may lag a few
  hours after the hourly refresh if a center updates their calendar.
