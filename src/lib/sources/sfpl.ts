import { fromZonedTime } from "date-fns-tz";
import type { SourceDefinition, NormalizedEvent } from "../types";

// SF Public Library — Storytime & Kids Programs
// Scrapes https://sfpl.org/events?field_event_topic_target_id=<id>&page=<n>
// Server-rendered Drupal 10 with no bot-protection (no API key needed).
//
// Topics fetched:
//   407 = Storytime for Babies      (age 0–18 mo)
//   422 = Storytime for Toddlers    (age 12–36 mo)
//   450 = Storytime for Preschoolers (age 36–60 mo)
//   393 = Storytime for Families    (all ages)
//
// Events span roughly the next 3 months; we stop paginating once all events
// on a page are beyond MAX_DAYS_AHEAD to avoid unnecessary fetches.

const BASE_URL = "https://sfpl.org";
const TZ = "America/Los_Angeles";
const MAX_DAYS_AHEAD = 45;

// ─── Branch coordinates ───────────────────────────────────────────────────
// Slugs come from `/locations/<slug>` in the event HTML.
// Lat/lng fetched from the SFPL locations map view; addresses from sfpl.org.

interface BranchInfo {
  location: string;
  lat: number;
  lng: number;
}

const BRANCHES: Record<string, BranchInfo> = {
  "main-library":       { location: "SF Main Library, 100 Larkin St, San Francisco",                 lat: 37.779081, lng: -122.415771 },
  "anza":               { location: "SF Anza Branch Library, 550 37th Ave, San Francisco",           lat: 37.778697, lng: -122.497013 },
  "bayview":            { location: "SF Bayview Branch Library, 5075 3rd St, San Francisco",         lat: 37.732614, lng: -122.391170 },
  "bernal-heights":     { location: "SF Bernal Heights Branch Library, 500 Cortland Ave, SF",       lat: 37.738922, lng: -122.416054 },
  "chinatown":          { location: "SF Chinatown Branch Library, 1135 Powell St, San Francisco",    lat: 37.795198, lng: -122.410245 },
  "eureka-valley":      { location: "SF Eureka Valley Branch Library, 1 Jose Sarria Ct, SF",        lat: 37.764082, lng: -122.431816 },
  "excelsior":          { location: "SF Excelsior Branch Library, 4400 Mission St, San Francisco",  lat: 37.727140, lng: -122.433221 },
  "glen-park":          { location: "SF Glen Park Branch Library, 653 Chenery St, San Francisco",   lat: 37.734000, lng: -122.434000 },
  "golden-gate-valley": { location: "SF Golden Gate Valley Branch Library, 1801 Green St, SF",      lat: 37.796852, lng: -122.429035 },
  "ingleside":          { location: "SF Ingleside Branch Library, 1298 Ocean Ave, San Francisco",   lat: 37.724226, lng: -122.456314 },
  "marina":             { location: "SF Marina Branch Library, 1890 Chestnut St, San Francisco",    lat: 37.801300, lng: -122.434000 },
  "merced":             { location: "SF Merced Branch Library, 155 Winston Dr, San Francisco",      lat: 37.726783, lng: -122.474481 },
  "mission":            { location: "SF Mission Branch Library, 300 Bartlett St, San Francisco",    lat: 37.752009, lng: -122.419871 },
  "mission-bay":        { location: "SF Mission Bay Branch Library, 960 4th St, San Francisco",     lat: 37.775300, lng: -122.393000 },
  "noe-valley":         { location: "SF Noe Valley Branch Library, 451 Jersey St, San Francisco",   lat: 37.750200, lng: -122.435000 },
  "north-beach":        { location: "SF North Beach Branch Library, 850 Columbus Ave, San Francisco", lat: 37.802581, lng: -122.413964 },
  "ocean-view":         { location: "SF Ocean View Branch Library, 345 Randolph St, San Francisco", lat: 37.714180, lng: -122.465951 },
  "ortega":             { location: "SF Ortega Branch Library, 3223 Ortega St, San Francisco",      lat: 37.751258, lng: -122.498025 },
  "park":               { location: "SF Park Branch Library, 1833 Page St, San Francisco",          lat: 37.770173, lng: -122.451027 },
  "parkside":           { location: "SF Parkside Branch Library, 1200 43rd Ave, San Francisco",     lat: 37.743191, lng: -122.479389 },
  "portola":            { location: "SF Portola Branch Library, 2435 San Bruno Ave, San Francisco", lat: 37.727060, lng: -122.406516 },
  "potrero":            { location: "SF Potrero Branch Library, 1616 20th St, San Francisco",       lat: 37.760072, lng: -122.397635 },
  "presidio":           { location: "SF Presidio Branch Library, 3150 Sacramento St, San Francisco", lat: 37.788882, lng: -122.444881 },
  "richmond":           { location: "SF Richmond Branch Library, 351 9th Ave, San Francisco",       lat: 37.781883, lng: -122.468155 },
  "sunset":             { location: "SF Sunset Branch Library, 1305 18th Ave, San Francisco",       lat: 37.763385, lng: -122.476292 },
  "visitacion-valley":  { location: "SF Visitacion Valley Branch Library, 201 Leland Ave, SF",     lat: 37.712466, lng: -122.407839 },
  "west-portal":        { location: "SF West Portal Branch Library, 190 Lenox Way, San Francisco",  lat: 37.741362, lng: -122.466195 },
  "western-addition":   { location: "SF Western Addition Branch Library, 1550 Scott St, SF",        lat: 37.784213, lng: -122.437639 },
  // Fallback for unknown branches
  "virtual-library":    { location: "SF Public Library (Virtual)",                                  lat: 37.779081, lng: -122.415771 },
};

const DEFAULT_BRANCH: BranchInfo = {
  location: "San Francisco Public Library",
  lat: 37.779081,
  lng: -122.415771,
};

// ─── Topic → age range ────────────────────────────────────────────────────

interface TopicConfig {
  id: number;
  label: string;
  ageMin: number;
  ageMax: number;
}

const TOPICS: TopicConfig[] = [
  { id: 407, label: "Storytime for Babies",       ageMin: 0,  ageMax: 18  },
  { id: 422, label: "Storytime for Toddlers",     ageMin: 12, ageMax: 36  },
  { id: 450, label: "Storytime for Preschoolers", ageMin: 36, ageMax: 60  },
  { id: 393, label: "Storytime for Families",     ageMin: 0,  ageMax: 120 },
];

// ─── Date/time parsing ────────────────────────────────────────────────────
// Input format: "Saturday, 5/16/2026, 11:00 - 12:00"

function parseDateRange(raw: string): { startAt: Date; endAt: Date } | null {
  const m = raw.match(/(\d+)\/(\d+)\/(\d+),\s*(\d+):(\d+)\s*-\s*(\d+):(\d+)/);
  if (!m) return null;
  const [, mo, dy, yr, sh, sm, eh, em] = m.map(Number);
  const startAt = fromZonedTime(new Date(yr, mo - 1, dy, sh, sm), TZ);
  const endAt   = fromZonedTime(new Date(yr, mo - 1, dy, eh, em), TZ);
  return { startAt, endAt };
}

// ─── HTML parser ──────────────────────────────────────────────────────────

interface ParsedEvent {
  urlPath: string;  // e.g. "/events/2026/05/16/storytime-babies"
  title: string;
  dateRaw: string;
  locationSlug: string;
  startAt: Date;
  endAt: Date;
}

function parseEventsPage(html: string): { events: ParsedEvent[]; done: boolean } {
  const cutoff = Date.now() + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000;
  const events: ParsedEvent[] = [];
  let done = false;

  // Each event is an <article about="/events/...">
  const articleRe = /<article[^>]+about="(\/events\/[^"]+)"[^>]*class="[^"]*event[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
  let match: RegExpExecArray | null;

  while ((match = articleRe.exec(html)) !== null) {
    const urlPath = match[1];
    const body = match[2];

    // Date/time span
    const dateMatch = body.match(/class="date-display-range">([^<]+)</);
    if (!dateMatch) continue;
    const dateRaw = dateMatch[1].trim();

    const parsed = parseDateRange(dateRaw);
    if (!parsed) continue;

    // Once we've passed the lookahead window we can stop requesting more pages
    if (parsed.startAt.getTime() > cutoff) {
      done = true;
      continue;
    }

    // Title
    const titleMatch = body.match(/class="event__title"[^>]*>[\s\S]*?<span>([^<]+)<\/span>/);
    const title = titleMatch ? titleMatch[1].trim() : "Storytime";

    // Location slug — href="/locations/<slug>"
    const locMatch = body.match(/href="\/locations\/([^"]+)"/);
    const locationSlug = locMatch ? locMatch[1] : "main-library";

    events.push({ urlPath, title, dateRaw, locationSlug, ...parsed });
  }

  return { events, done };
}

// ─── Fetch one topic (all pages) ─────────────────────────────────────────

async function fetchTopic(topic: TopicConfig): Promise<NormalizedEvent[]> {
  const events: NormalizedEvent[] = [];
  const seen = new Set<string>();

  for (let page = 0; ; page++) {
    const url = `${BASE_URL}/events?field_event_topic_target_id=${topic.id}&page=${page}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`SFPL HTTP ${res.status} for ${url}`);

    const html = await res.text();

    // Detect last page — "N - N of N results" where N - 1 page * 25 >= total
    const countMatch = html.match(/(\d+)\s*-\s*(\d+)\s*of\s*(\d+)\s*results/);
    const isLastPage = !countMatch || parseInt(countMatch[2]) >= parseInt(countMatch[3]);

    const { events: pageEvents, done } = parseEventsPage(html);

    for (const e of pageEvents) {
      if (seen.has(e.urlPath)) continue;
      seen.add(e.urlPath);

      const branch = BRANCHES[e.locationSlug] ?? DEFAULT_BRANCH;
      const externalId = `${e.urlPath.replace("/events/", "")}`;

      events.push({
        sourceId: "sfplLibrary",
        externalId,
        title: e.title,
        description: "",
        startAt: e.startAt,
        endAt: e.endAt,
        location: branch.location,
        lat: branch.lat,
        lng: branch.lng,
        ageMinMonths: topic.ageMin,
        ageMaxMonths: topic.ageMax,
        indoorness: "indoor",
        cost: "free",
        registration: "walk-in",
        scheduleLabel: null,
        url: `${BASE_URL}${e.urlPath}`,
        evergreen: false,
      });
    }

    if (isLastPage || done) break;
  }

  return events;
}

// ─── Source definition ────────────────────────────────────────────────────

export const sfplLibrarySource: SourceDefinition = {
  id: "sfplLibrary",
  name: "SF Public Library",
  description: "Storytime for babies, toddlers, preschoolers & families across 28 SFPL branches",
  async fetch() {
    // Fetch all topics in parallel
    const results = await Promise.all(TOPICS.map(fetchTopic));
    // Merge and de-duplicate across topics (same event can appear in multiple topic filters)
    const seen = new Set<string>();
    const allEvents: NormalizedEvent[] = [];
    for (const batch of results) {
      for (const e of batch) {
        if (!seen.has(e.externalId)) {
          seen.add(e.externalId);
          allEvents.push(e);
        }
      }
    }
    return { events: allEvents };
  },
};
