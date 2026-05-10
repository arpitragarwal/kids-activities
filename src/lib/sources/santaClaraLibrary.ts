import { fromZonedTime } from "date-fns-tz";
import type { SourceDefinition, NormalizedEvent, Indoorness } from "../types";

// Santa Clara City Library
// URL: https://www.sclibrary.org/calendar/events/-curm-{M}/-cury-{Y}
// Server-rendered HTML behind Akamai — needs a full Chrome-like header set
// (sec-ch-ua, Sec-Fetch-*, Upgrade-Insecure-Requests, Accept-Encoding) to pass
// the bot check. A bare User-Agent returns 403.

const BASE_URL = "https://www.sclibrary.org";
const TZ = "America/Los_Angeles";

// ─── Branch coordinates ───────────────────────────────────────────────────

const BRANCHES: Record<string, { location: string; lat: number; lng: number }> = {
  central:   { location: "Central Library — 2635 Homestead Rd, Santa Clara",   lat: 37.3695, lng: -121.9730 },
  northside: { location: "Northside Branch — 695 Moreland Way, Santa Clara",   lat: 37.3810, lng: -121.9560 },
  mission:   { location: "Mission Branch — 1098 Lexington St, Santa Clara",    lat: 37.3453, lng: -121.9450 },
};

const DEFAULT_COORDS = { lat: 37.3541, lng: -121.9552 };

// ─── Kids filter ──────────────────────────────────────────────────────────

const KID_KEYWORDS = [
  "storytime", "story time", "youth", "children", "kids",
  "preschool", "toddler", "baby", "family", "stem", "steam",
  "little learner", "learner", "lego", "playdate",
];

const EXCLUDE_KEYWORDS = [
  "esl", "citizenship", "adult enrichment", "senior",
  "teen ", "tween", "book club", "library closed", "holiday",
  "trustees", "unbook", "genealogy", "landlord",
  "financial planning", "retrotech", "lawyers in",
  "smartphone", "iphone", "tech class", "crafting club",
];

function isKidsEvent(title: string): boolean {
  const t = title.toLowerCase();
  if (EXCLUDE_KEYWORDS.some((k) => t.includes(k))) return false;
  return KID_KEYWORDS.some((k) => t.includes(k));
}

// ─── Age parsing from title text ──────────────────────────────────────────

function ageRangeFromTitle(title: string): { min: number | null; max: number | null } {
  const t = title.toLowerCase();
  // "0-1.5 years", "0-2 years"
  const fracMatch = t.match(/(\d+)\s*[-–]\s*(\d+\.?\d*)\s*year/);
  if (fracMatch) {
    return { min: Math.round(parseFloat(fracMatch[1]) * 12), max: Math.round(parseFloat(fracMatch[2]) * 12) };
  }
  // "18 months - 2 years", "18 months to 2 years"
  const moYrMatch = t.match(/(\d+)\s*months?\s*[-–to]+\s*(\d+)\s*years?/);
  if (moYrMatch) {
    return { min: parseInt(moYrMatch[1], 10), max: parseInt(moYrMatch[2], 10) * 12 };
  }
  // "(2 - 4 Years)" or "(2-4 Years)"
  const yrMatch = t.match(/\((\d+)\s*[-–]\s*(\d+)\s*years?\)/);
  if (yrMatch) {
    return { min: parseInt(yrMatch[1], 10) * 12, max: parseInt(yrMatch[2], 10) * 12 };
  }
  if (/\bbaby|babies\b/.test(t)) return { min: 0, max: 18 };
  if (/\btoddler\b/.test(t))     return { min: 12, max: 36 };
  if (/family|all ages/.test(t)) return { min: 0, max: 144 };
  return { min: null, max: null };
}

// ─── Time parsing ─────────────────────────────────────────────────────────

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

// ─── HTML entity decoding ─────────────────────────────────────────────────

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

  // Split on calendar_day_with_items cells (server-rendered table; no nested <td>)
  const cellChunks = html.split(/<td[^>]*class="[^"]*calendar_day_with_items[^"]*"[^>]*>/i).slice(1);

  for (const chunk of cellChunks) {
    // Trim at the next </td>
    const cellHtml = chunk.slice(0, chunk.indexOf("</td>") + 1) || chunk;

    // Day number is the first numeric text in the cell (before any tags)
    const dayNumMatch = cellHtml.replace(/<[^>]+>/g, " ").match(/^\s*(\d+)/);
    if (!dayNumMatch) continue;
    const day = parseInt(dayNumMatch[1], 10);

    // Split on calendar_item divs
    const itemChunks = cellHtml
      .split(/<div[^>]*class="calendar_item"[^>]*>/i)
      .slice(1);

    for (const itemChunk of itemChunks) {
      // Time
      const timeMatch = itemChunk.match(/<span[^>]*class="calendar_eventtime"[^>]*>([^<]+)<\/span>/i);
      if (!timeMatch) continue;
      const timeStr = timeMatch[1].trim();

      // Link + raw title
      const linkMatch = itemChunk.match(/<a[^>]*class="calendar_eventlink"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/i);
      if (!linkMatch) continue;
      const href = linkMatch[1];
      const rawTitle = decodeHtmlEntities(linkMatch[2].trim());

      // Skip cancelled
      if (/cancel/i.test(rawTitle)) continue;

      // Kids filter (on full rawTitle including branch prefix)
      if (!isKidsEvent(rawTitle)) continue;

      // Parse "BRANCH: Event name"
      const branchMatch = rawTitle.match(/^([A-Z]+):\s*(.+)$/);
      const branchKey = (branchMatch?.[1] ?? "").toLowerCase();
      const title = branchMatch?.[2]?.trim() ?? rawTitle;

      // Skip online/offsite (no useful location)
      if (branchKey === "online" || branchKey === "offsite") continue;

      const branchInfo = BRANCHES[branchKey];
      const lat = branchInfo?.lat ?? DEFAULT_COORDS.lat;
      const lng = branchInfo?.lng ?? DEFAULT_COORDS.lng;
      const location = branchInfo?.location ?? `Santa Clara City Library`;

      const startAt = parseEventTime(timeStr, day, month, year);
      const { min, max } = ageRangeFromTitle(rawTitle);

      // Event ID from URL for deduplication
      const idMatch = href.match(/\/Event\/(\d+)\//);
      const externalId = idMatch?.[1] ?? href;

      const fullUrl = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      events.push({
        sourceId: "santaClaraLibrary",
        externalId,
        title,
        description: "",
        startAt,
        endAt: null,
        location,
        lat,
        lng,
        ageMinMonths: min,
        ageMaxMonths: max,
        indoorness: "indoor" as Indoorness,
        cost: "free",
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

export const santaClaraLibrarySource: SourceDefinition = {
  id: "santaClaraLibrary",
  name: "Santa Clara City Library",
  description: "Storytimes & kids programs at Santa Clara City Library (HTML scrape)",
  async fetch() {
    const now = new Date();
    const allEvents: NormalizedEvent[] = [];
    const seen = new Set<string>();

    // Fetch current + next 2 months
    for (let offset = 0; offset < 3; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();
      const url = `${BASE_URL}/calendar/events/-curm-${month}/-cury-${year}`;

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
      if (!res.ok) throw new Error(`Santa Clara Library HTTP ${res.status} for ${url}`);

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
