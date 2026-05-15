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

### Libraries — Drupal HTML scrape

| Id | Source | Mechanism |
|----|--------|-----------|
| `sfplLibrary` | SF Public Library (28 branches) | Scrapes `sfpl.org/events?field_event_topic_target_id=<id>` for 4 storytime topics; paginates up to 45 days out |
| `santaClaraLibrary` | Santa Clara City Library | Scrapes server-rendered HTML calendar at `sclibrary.org`; may return 403 on non-Vercel IPs |

### City events — HTML scrape

| Id | Source | Mechanism |
|----|--------|-----------|
| `redwoodCityEvents` | City of Redwood City Events | Scrapes the Vision Internet / Granicus calendar at `redwoodcity.org/about-the-city/visiting/city-events-calendar` (same markup as `santaClaraLibrary`); aggregates library, community, and parks events; kid-keyword filter rejects civic meetings, drop-in rec, and adult programming. Also covers Redwood City Library events (Storytime, Kid Makers, Cuentos y Cantos, etc.) since those are published into the city-wide calendar. |

### Museums

| Id | Source | Mechanism |
|----|--------|-----------|
| `randallMuseum` | Randall Museum (SF) | iCal feed via All-in-One Event Calendar plugin; expands RRULE recurrences into individual instances (Saturday Science, Afternoon Art, Animal Ambassador) |
| `sfMuseums` | 13 curated SF museums & venues | Hardcoded static evergreen cards (Cal Academy, Exploratorium, CCM, de Young, SFMOMA, Asian Art, Walt Disney, CJM, SF Zoo, Aquarium of the Bay, Conservatory of Flowers, Japanese Tea Garden, Bay Model) |

### Other

| Id | Source | Mechanism |
|----|--------|-----------|
| `parks` | Curated parks & indoor places | Hardcoded list in `src/lib/sources/parks.ts` |
| `music-together` | Music Together (Bay Area centers) | Scrapes `calendar.aspx` from each center's Main Street Sites page; falls back to evergreen for centers without a calendar |

When a source breaks it shows up on `/health` with the last error.

### Pools

Hardcoded seasonal schedules in `src/lib/sources/pools.ts`. Each pool shows as **stale** on `/health` once its `scheduleEndsAt` passes — update `sessions[]` and bump the date each season.

| Id | Pool | Season |
|----|------|--------|
| `mvPool` | MV Rengstorff Park Aquatics Center | May 23 – Aug 31 2026 |
| `eaglePool` | MV Eagle Park Pool | Jun 15 – Aug 31 2026 |
| `santaClaraGomezPool` | Santa Clara Mary Gomez Aquatic Center | Jun 8 – Aug 30 2026 |
| `santaClaraWarburtonPool` | Santa Clara Warburton Aquatic Center | Jun 8 – Aug 29 2026 |
| `cupertinoBlackberryPool` | Cupertino Blackberry Farm Pool | May 23 – Sep 7 2026 (verify each season) |
| `dalyCityPool` | Daly City Giammona Pool | Jun 6 – Aug 30 2026 |
| `campbellPool` | Campbell Community Center Pool | Jun 16 – Aug 7 2026 |
| `sanMateoJoinvillePool` | San Mateo Joinville Swim Center | Jun 15 – Aug 8 2026 |
| `sanMateoKingPool` | San Mateo King Swim Center | Jun 15 – Aug 8 2026 |
| `sfCoffmanPool` | SF Coffman Aquatic Center | Spring 2026: Apr 21 – Jun 6 |
| `sfGarfieldPool` | SF Garfield Aquatic Center | Spring 2026: Mar 15 – Jun 4 |
| `sfHamiltonPool` | SF Hamilton Aquatic Center (with waterslides) | Spring 2026: Mar 17 – Jun 6 |
| `sfMlkPool` | SF Dr. Martin Luther King Jr. Pool | Spring 2026: Apr 7 – Jun 6 |
| `sfMissionPool` | SF Mission Community Pool (outdoor) | Spring 2026: May 12 – Jun 6 |
| `sfNorthBeachPool` | SF North Beach Aquatic Center (warm pool, 86°F) | Spring 2026: Mar 17 – Jun 12 |
| `sfRossiPool` | SF Rossi Pool | Spring 2026: Mar 15 – Jun 4 |

SF pools run year-round indoor and publish new schedules quarterly as PDFs on each facility page (`sfrecpark.org/{ID}/{Pool}`). When `scheduleEndsAt` passes, the source shows as stale — refresh by downloading the new PDF, parsing rec/family swim slots, and bumping the dates in `pools.ts`.

#### Pools not yet integrated

| Pool | City | Schedule URL | Blocker |
|------|------|-------------|---------|
| Rancho Rinconada Pool | Cupertino | https://ranchopool.org/rec-swim/ | 2026 hours not yet published on site; opens May 9 |
| Washington Swim Center / Swim Complex | Sunnyvale | https://www.sunnyvale.ca.gov/recreation-and-community/classes-and-activities/aquatics/pools | Drop-in hours not prominently published |
| Balboa Pool | San Francisco | https://sfrecpark.org/488/Balboa-Pool | Closed for renovations |
| Sava Pool | San Francisco | https://sfrecpark.org/facilities/facility/details/Sava-Pool-220 | Closed through summer 2026 for repairs |
| Fair / Camden / Mayfair / Rotary Ryland pools | San Jose | https://www.sanjoseca.gov/your-government/departments-offices/parks-recreation-neighborhood-services/athletics-fitness/swimming-and-pools | Hours buried in ActiveNet registration portal |
| Red Morton Community Center Pool | Redwood City | https://www.redwoodcity.org/departments/parks-recreation-and-community-services/sports/aquatics | Schedule not prominently published |
| Rinconada Pool | Palo Alto | https://paloaltoswim.com/pool-schedule/ | Schedule is a PDF download, not HTML |
| Burgess Pool | Menlo Park | https://menloswim.com/about/locations/burgess-location/ | Operated by third-party; rec swim window unclear |
| Silliman Activity & Family Aquatic Center | Newark | https://www.newarkca.gov/departments/recreation-and-community-services/aquatic-center-hours | Indoor waterpark (slides/lazy river), not traditional rec swim |
| Aqua Adventure Waterpark | Fremont | https://goaquaadventure.com/hours-info.php | Waterpark, not a traditional pool |
| Dan Oden Swim Complex | Union City | https://www.unioncityca.gov/616/Aquatics | Potential 2026 renovation closure — verify before adding |
| LGHS Community Aquatic Center | Los Gatos | https://www.lgsrecreation.org/aquatics/ | Primarily lap swim; rec swim availability unclear |
| Belle Haven Pool | Menlo Park | https://www.menlopark.gov/Venues/Belle-Haven-Pool | Reported closed as of March 2026 |

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
