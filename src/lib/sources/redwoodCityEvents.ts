import { fromZonedTime } from "date-fns-tz";
import type { SourceDefinition, NormalizedEvent, Indoorness, Cost } from "../types";

// Redwood City — City Events Calendar
// URL: https://www.redwoodcity.org/about-the-city/visiting/city-events-calendar/-curm-{M}/-cury-{Y}
//
// Same Vision Internet / Granicus CMS as Santa Clara Library, with the same
// `calendar_day_with_items` / `calendar_item` / `calendar_eventtime` /
// `calendar_eventlink` markup. The host is fronted by Akamai and requires a
// full Chrome-like header set to bypass the bot check (a bare User-Agent 403s).
//
// This feed aggregates library, recreation, civic, senior, and community
// events. We filter aggressively to kid-relevant entries via a keyword
// include/exclude pair, then map venue keywords in the title to lat/lng.
// As a happy side effect, this unblocks Redwood City Library events too —
// they're published into the city calendar rather than a dedicated library CMS.

const BASE_URL = "https://www.redwoodcity.org";
const TZ = "America/Los_Angeles";

// ─── Venue map ────────────────────────────────────────────────────────────
// Matchers run against the raw title; first match wins. Many library events
// suffix their venue as "@ Redwood Shores" / "@ Schaberg" / "@ Downtown".

interface Venue {
  location: string;
  lat: number;
  lng: number;
  indoorness: Indoorness;
  cost: Cost;
  matchers: RegExp[];
}

const VENUES: Venue[] = [
  {
    location: "Redwood Shores Library — 399 Marine Pkwy, Redwood Shores",
    lat: 37.5318, lng: -122.2486,
    indoorness: "indoor",
    cost: "free",
    matchers: [/redwood shores/i],
  },
  {
    location: "Schaberg Library — 2140 Euclid Ave, Redwood City",
    lat: 37.4870, lng: -122.2179,
    indoorness: "indoor",
    cost: "free",
    matchers: [/schaberg/i],
  },
  {
    location: "Downtown Library — 1044 Middlefield Rd, Redwood City",
    lat: 37.4863, lng: -122.2316,
    indoorness: "indoor",
    cost: "free",
    matchers: [/downtown library|@\s*downtown\b/i],
  },
  {
    location: "Magical Bridge Playground — 1455 Madison Ave, Redwood City",
    lat: 37.4849, lng: -122.2354,
    indoorness: "outdoor",
    cost: "free",
    matchers: [/magical bridge/i],
  },
  {
    location: "Red Morton Community Center — 1455 Madison Ave, Redwood City",
    lat: 37.4744, lng: -122.2306,
    indoorness: "indoor",
    cost: "unknown",
    matchers: [/red morton|\brmcc\b/i],
  },
  {
    location: "Veterans Memorial Building — 1455 Madison Ave, Redwood City",
    lat: 37.4744, lng: -122.2306,
    indoorness: "indoor",
    cost: "unknown",
    matchers: [/veterans memorial/i],
  },
  {
    location: "Stulsaft Park — 3737 Farm Hill Blvd, Redwood City",
    lat: 37.4869, lng: -122.2259,
    indoorness: "outdoor",
    cost: "free",
    matchers: [/stulsaft/i],
  },
];

const DEFAULT_VENUE: Omit<Venue, "matchers"> = {
  location: "Redwood City",
  lat: 37.4852, lng: -122.2364,
  indoorness: "either",
  cost: "unknown",
};

// ─── Kids filter ──────────────────────────────────────────────────────────
// EXCLUDE wins over INCLUDE: a title matching any exclude term is rejected
// even if it has kid keywords (e.g. "Teen Storytime" — we skip those).

const KID_KEYWORDS = [
  // Storytime / library kids programming
  "storytime", "story time", "tiny tales", "pajama time", "stories and songs",
  "pequeños aprendices", "pequenos aprendices", "cuentos", "club de lectura",
  "cuentos y cantos", "kid maker", "kid makers",
  // Generic kid markers
  "kids ", "kids:", "kids@", "kid ", "kid:",
  "children", "niños", "ninos", "child ", "child:",
  "toddler", "preschool", "infant", " baby", "babies",
  "family", "all ages",
  // Specific RWC programs that are kid/family targeted
  "magical music", "magical motion", "magical bridge",
  "music & movement", "music and movement", "play malinky",
  "lego", "robotics", "stem", "steam",
  "ventriloquist", "puppet show",
  "comic book day", "bike to the library",
  "free art project",
];

const EXCLUDE_KEYWORDS = [
  // Adult rec drop-ins (separately covered by redwoodCityRec)
  "drop-in basketball", "drop in basketball",
  "drop-in pickleball", "drop in pickleball",
  "drop-in volleyball", "drop in volleyball",
  "drop-in badminton", "drop in badminton",
  // Civic
  "council meeting", "commission meeting", "board meeting",
  "public hearing", "city council", "ribbon cutting",
  // Senior / adult-only
  "senior center", "senior ",
  "esl conversation", "esl ",
  "drop in tech", "tech help",
  "phase2careers", "small business conference",
  "tutor training", " tutor",
  "rebuilding self", "trace your family",
  "movie at the senior",
  // Adult enrichment / hobby
  "art salon", "open makers", "open sewing",
  "essentrics", "stretch workout",
  "introduction to 3d printing",
  "libros y café", "libros y cafe",
  // Operational / not an activity
  "free shred", "donation event", "donación", "donacion",
  "laundry and shower",
  "rose show", "rose sale",
  "mental health kit",
  "annual spring cleanup",
  // Teen-only (this app targets younger kids — drop noise)
  "teen ", "teen:", "teens:",
  // Late-night
  "video game night", "movie night",
];

function classify(rawTitle: string): { include: boolean; venue: Omit<Venue, "matchers"> } {
  const t = rawTitle.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((k) => t.includes(k))) {
    return { include: false, venue: DEFAULT_VENUE };
  }
  const kid = KID_KEYWORDS.some((k) => t.includes(k));
  if (!kid) return { include: false, venue: DEFAULT_VENUE };

  for (const v of VENUES) {
    if (v.matchers.some((m) => m.test(rawTitle))) {
      const { matchers: _m, ...rest } = v;
      return { include: true, venue: rest };
    }
  }
  return { include: true, venue: DEFAULT_VENUE };
}

// ─── Age parsing (best-effort from title) ─────────────────────────────────

function ageRangeFromTitle(title: string): { min: number | null; max: number | null } {
  const t = title.toLowerCase();
  // "0-1.5 years", "0-2 years"
  const fracMatch = t.match(/(\d+)\s*[-–]\s*(\d+\.?\d*)\s*year/);
  if (fracMatch) {
    return {
      min: Math.round(parseFloat(fracMatch[1]) * 12),
      max: Math.round(parseFloat(fracMatch[2]) * 12),
    };
  }
  // "18 months - 2 years"
  const moYrMatch = t.match(/(\d+)\s*months?\s*[-–to]+\s*(\d+)\s*years?/);
  if (moYrMatch) {
    return { min: parseInt(moYrMatch[1], 10), max: parseInt(moYrMatch[2], 10) * 12 };
  }
  // "(2 - 4 Years)" / "(2-4 Years)"
  const yrMatch = t.match(/\((\d+)\s*[-–]\s*(\d+)\s*years?\)/);
  if (yrMatch) {
    return { min: parseInt(yrMatch[1], 10) * 12, max: parseInt(yrMatch[2], 10) * 12 };
  }
  if (/\bbaby|babies\b/.test(t)) return { min: 0, max: 18 };
  if (/\btoddler\b/.test(t))     return { min: 12, max: 36 };
  if (/\bpreschool\b/.test(t))   return { min: 30, max: 72 };
  if (/family|all ages/.test(t)) return { min: 0, max: 144 };
  return { min: null, max: null };
}

// ─── Time / HTML helpers ──────────────────────────────────────────────────

function parseEventTime(timeStr: string, day: number, month: number, year: number): Date {
  const m = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return fromZonedTime(new Date(year, month - 1, day, 10, 0), TZ);
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return fromZonedTime(new Date(year, month - 1, day, h, min), TZ);
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

// ─── HTML parser ──────────────────────────────────────────────────────────

function parseCalendarPage(html: string, month: number, year: number): NormalizedEvent[] {
  const events: NormalizedEvent[] = [];
  const cellChunks = html.split(/<td[^>]*class="[^"]*calendar_day_with_items[^"]*"[^>]*>/i).slice(1);

  for (const chunk of cellChunks) {
    const cellHtml = chunk.slice(0, chunk.indexOf("</td>") + 1) || chunk;

    // The day number is the first numeric text in the cell.
    const dayNumMatch = cellHtml.replace(/<[^>]+>/g, " ").match(/^\s*(\d+)/);
    if (!dayNumMatch) continue;
    const day = parseInt(dayNumMatch[1], 10);

    const itemChunks = cellHtml.split(/<div[^>]*class="calendar_item"[^>]*>/i).slice(1);
    for (const itemChunk of itemChunks) {
      const timeMatch = itemChunk.match(/<span[^>]*class="calendar_eventtime"[^>]*>([^<]+)<\/span>/i);
      if (!timeMatch) continue;

      const linkMatch = itemChunk.match(/<a[^>]*class="calendar_eventlink"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      if (!linkMatch) continue;

      const href = linkMatch[1];
      const rawTitle = decodeHtmlEntities(linkMatch[2].trim());

      if (/cancel/i.test(rawTitle)) continue;

      const { include, venue } = classify(rawTitle);
      if (!include) continue;

      const startAt = parseEventTime(timeMatch[1].trim(), day, month, year);
      const { min, max } = ageRangeFromTitle(rawTitle);

      const idMatch = href.match(/\/Event\/(\d+)\//);
      const externalId = idMatch?.[1] ?? href;
      const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      events.push({
        sourceId: "redwoodCityEvents",
        externalId,
        title: rawTitle,
        description: "",
        startAt,
        endAt: null,
        location: venue.location,
        lat: venue.lat,
        lng: venue.lng,
        ageMinMonths: min,
        ageMaxMonths: max,
        indoorness: venue.indoorness,
        cost: venue.cost,
        registration: "walk-in",
        scheduleLabel: null,
        url: fullUrl,
        evergreen: false,
      });
    }
  }

  return events;
}

// ─── Source definition ────────────────────────────────────────────────────

export const redwoodCityEventsSource: SourceDefinition = {
  id: "redwoodCityEvents",
  name: "City of Redwood City Events",
  description: "Library, parks, and community events aggregated from redwoodcity.org (HTML scrape)",
  async fetch() {
    const now = new Date();
    const allEvents: NormalizedEvent[] = [];
    const seen = new Set<string>();

    // Fetch current + next 2 months.
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const url = `${BASE_URL}/about-the-city/visiting/city-events-calendar/-curm-${month}/-cury-${year}`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          "Accept-Encoding": "gzip, deflate, br",
          "sec-ch-ua": '"Chromium";v="126", "Not.A/Brand";v="24"',
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"macOS"',
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "none",
          "Sec-Fetch-User": "?1",
          "Upgrade-Insecure-Requests": "1",
        },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`Redwood City Events HTTP ${res.status} for ${url}`);

      const html = await res.text();
      for (const e of parseCalendarPage(html, month, year)) {
        if (!seen.has(e.externalId)) {
          seen.add(e.externalId);
          allEvents.push(e);
        }
      }
    }

    return { events: allEvents };
  },
};
