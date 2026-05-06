import type { SourceDefinition, NormalizedEvent } from "../types";
import { fromZonedTime } from "date-fns-tz";

// ─── MT API types ─────────────────────────────────────────────────────────

interface MtApiCenter {
  center_name: string;
  address: string;
  city: string;
  state: string;
  zipcode: string;
  lat: string;
  long: string;
  website: string;
  class_code: string;
  distance: string;
}

// ─── Centers with calendar pages but not in the MT API ────────────────────

interface StaticCenter {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  website: string;
}

const STATIC_CENTERS: StaticCenter[] = [
  {
    id: "mt-mp",
    name: "Music Together Menlo Park & Palo Alto",
    address: "1300 Crane Ave",
    city: "Menlo Park",
    state: "CA",
    lat: 37.4459,
    lng: -122.1799,
    website: "https://www.mt-mp.com",
  },
];

// ─── Calendar HTML parser ──────────────────────────────────────────────────

interface ParsedSession {
  dayId: string;   // "2026-4-6"
  classType: string;
  time: string;    // "9:30 AM"
  teacher?: string;
}

// Sites use different field orders before the time:
//   mt-mp.com:       ClassType<br>Time<br>Teacher?
//   peninsula:       ClassType<br>LOCATION<br>Time
//   eastbaymt:       Venue<br>ClassType<br>Time
//   musictogethersf: Venue<br>SubTitle<br>ClassType<br>Time
//   smileynotes:     Type<br>FullName<br>StartTime–EndTime<br>Teacher<br>RegisterLink
//
// Strategy: split each event item on <br>, find the time by pattern,
// then find the class type by keyword scan.
const CLASS_TYPE_RE = /mixed.?age|bab(y|ies)?|hebrew|outdoor|music together|vocal|family\s*music|combo/i;
const TIME_RE = /\d{1,2}:\d{2}\s*[AP]M/i;

function parseCalendarHtml(html: string): ParsedSession[] {
  const sessions: ParsedSession[] = [];

  const dayRe = /id="calendarDay-(\d{4}-\d+-\d+)"[^>]*>([\s\S]*?)(?=id="calendarDay-|<\/table|$)/g;
  let dm: RegExpExecArray | null;
  while ((dm = dayRe.exec(html)) !== null) {
    const dayId = dm[1];
    const daySection = dm[2];

    // Each event is wrapped in <div class="calendarDayItemResponsive">
    const itemSections = daySection.split(/<div\s+class="calendarDayItemResponsive">/i).slice(1);

    for (const itemHtml of itemSections) {
      // Preserve BR positions as separators, strip all other HTML tags
      const parts = itemHtml
        .replace(/<br\s*\/?>/gi, "\x01")
        .replace(/<[^>]+>/g, "")
        .replace(/&[a-z]+;/gi, " ")
        .replace(/&#\d+;/g, "")
        .split("\x01")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      // Find the time field (may be "9:30 AM" or "4:30 PM - 5:15 PM")
      const timeIdx = parts.findIndex((p) => TIME_RE.test(p));
      if (timeIdx < 1) continue;

      const timeMatch = parts[timeIdx].match(TIME_RE);
      if (!timeMatch) continue;
      const time = timeMatch[0]; // take only the start time

      // Find class type — prefer keyword match, fall back to part just before time
      const classType =
        parts.find((p) => CLASS_TYPE_RE.test(p)) ?? parts[timeIdx - 1];
      if (!classType) continue;

      // Teacher: first part after time that isn't "Register" or another time
      const teacher = parts
        .slice(timeIdx + 1)
        .find(
          (p) => !/^register/i.test(p) && !TIME_RE.test(p) && p.length > 0,
        );

      sessions.push({ dayId, classType, time, teacher });
    }
  }

  return sessions;
}

// ─── Time parsing ──────────────────────────────────────────────────────────

function sessionToStartAt(dayId: string, time: string): Date | null {
  const [year, month, day] = dayId.split("-").map(Number);
  const tm = time.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!tm) return null;
  let h = parseInt(tm[1]);
  const min = parseInt(tm[2]);
  const ampm = tm[3].toUpperCase();
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  const localStr = [
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    `T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00`,
  ].join("");
  return fromZonedTime(localStr, "America/Los_Angeles");
}

// ─── Build NormalizedEvent from a parsed session ───────────────────────────

function makeEvent(
  session: ParsedSession,
  sourceKey: string,
  centerName: string,
  address: string,
  lat: number | null,
  lng: number | null,
  city: string,
  url: string,
): NormalizedEvent | null {
  const startAt = sessionToStartAt(session.dayId, session.time);
  if (!startAt) return null;
  if (startAt <= new Date()) return null; // skip past events

  const endAt = new Date(startAt.getTime() + 45 * 60 * 1000);

  const ageMaxMonths = /bab|infant/i.test(session.classType) ? 12 : 60;

  // sanitize for externalId
  const timePart = session.time.replace(/[^0-9]/g, "");
  const typePart = session.classType.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
  const externalId = `${sourceKey}-${session.dayId}-${typePart}-${timePart}`;

  const teacher = session.teacher ?? null;

  return {
    sourceId: "music-together",
    externalId,
    title: `Music Together — ${session.classType}`,
    description: `${session.classType} class at ${centerName}${teacher ? `, led by ${teacher}` : ""}. Ages 0–${ageMaxMonths <= 12 ? `${ageMaxMonths}m` : "5"} with caregiver. Register for the semester.`,
    startAt,
    endAt,
    location: `${address}, ${city}, CA`,
    lat,
    lng,
    ageMinMonths: 0,
    ageMaxMonths,
    indoorness: "indoor",
    cost: "paid",
    registration: "required",
    scheduleLabel: null,
    url,
    evergreen: false,
    raw: { session },
  };
}

// ─── Per-center calendar fetch ─────────────────────────────────────────────

async function fetchCalendarEvents(
  calendarUrl: string,
  sourceKey: string,
  centerName: string,
  address: string,
  lat: number | null,
  lng: number | null,
  city: string,
): Promise<NormalizedEvent[]> {
  const now = new Date();
  const monthStarts = [0, 1, 2, 3].map(
    (offset) => new Date(now.getFullYear(), now.getMonth() + offset, 1),
  );

  const allSessions: ParsedSession[] = [];

  for (const monthStart of monthStarts) {
    const mm = String(monthStart.getMonth() + 1).padStart(2, "0");
    const yy = String(monthStart.getFullYear()).slice(-2);
    const url = `${calendarUrl}?start_date=${encodeURIComponent(`${mm}/01/${yy}`)}`;
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; mv-kids-bot/1.0)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) break;
      const html = await res.text();
      if (!html.includes("calendarDay-")) break;
      allSessions.push(...parseCalendarHtml(html));
    } catch {
      break;
    }
  }

  // Deduplicate sessions (same event can appear when months overlap)
  const seen = new Set<string>();
  const unique = allSessions.filter((s) => {
    const key = `${s.dayId}-${s.classType}-${s.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique
    .map((s) => makeEvent(s, sourceKey, centerName, address, lat, lng, city, calendarUrl))
    .filter((e): e is NormalizedEvent => e !== null);
}

// ─── Source definition ─────────────────────────────────────────────────────

export const musicTogetherSource: SourceDefinition = {
  id: "music-together",
  name: "Music Together",
  description: "Music Together classes near Mountain View",

  async fetch() {
    // 1. Get all centers within 30 miles from the MT locator API
    const body = new URLSearchParams({
      locator_country: "United States",
      zip: "94041",
      address: "Mountain View, CA",
      distance_range: "30",
    });
    const listRes = await fetch("https://www.musictogether.com/classes/find_locations", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        Referer: "https://www.musictogether.com/class-locator",
        "User-Agent": "Mozilla/5.0 (compatible; mv-kids-bot/1.0)",
      },
      body: body.toString(),
    });
    if (!listRes.ok) throw new Error(`MT API ${listRes.status}`);
    const { results = [] } = (await listRes.json()) as { results?: MtApiCenter[] };

    // 2. Deduplicate by normalized website URL — keep the closest entry
    const byWebsite = new Map<string, MtApiCenter>();
    for (const c of results) {
      const key = c.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "").toLowerCase();
      const existing = byWebsite.get(key);
      if (!existing || parseFloat(c.distance) < parseFloat(existing.distance)) {
        byWebsite.set(key, c);
      }
    }
    const apiCenters = [...byWebsite.values()];

    // 3. Combine with static centers (those not in the API)
    type CenterEntry = {
      id: string;
      name: string;
      address: string;
      city: string;
      lat: number | null;
      lng: number | null;
      website: string;
    };

    const centers: CenterEntry[] = [
      ...apiCenters.map((c) => ({
        id: c.class_code,
        name: c.center_name,
        address: c.address,
        city: c.city,
        lat: parseFloat(c.lat) || null,
        lng: parseFloat(c.long) || null,
        website: c.website.startsWith("http") ? c.website : `https://${c.website}`,
      })),
      ...STATIC_CENTERS.map((c) => ({
        id: c.id,
        name: c.name,
        address: c.address,
        city: c.city,
        lat: c.lat,
        lng: c.lng,
        website: c.website,
      })),
    ];

    // 4. Fetch calendar events for each center in parallel
    const allEventArrays = await Promise.all(
      centers.map(async (c) => {
        const calUrl = `${c.website.replace(/\/$/, "")}/calendar.aspx`;
        const events = await fetchCalendarEvents(
          calUrl,
          c.id,
          c.name,
          c.address,
          c.lat,
          c.lng,
          c.city,
        ).catch(() => [] as NormalizedEvent[]);

        if (events.length > 0) return events;

        // Evergreen fallback for centers without a usable calendar
        return [
          {
            sourceId: "music-together",
            externalId: `${c.id}-evergreen`,
            title: `Music Together — ${c.name}`,
            description: `Music Together mixed-age classes (ages 0–5) with a caregiver. Semester-based program. ${c.city}, CA.`,
            startAt: new Date(),
            endAt: null,
            location: `${c.address}, ${c.city}, CA`,
            lat: c.lat,
            lng: c.lng,
            ageMinMonths: 0,
            ageMaxMonths: 60,
            indoorness: "indoor" as const,
            cost: "paid" as const,
            registration: "required" as const,
            scheduleLabel: null,
            url: c.website,
            evergreen: true,
          } satisfies NormalizedEvent,
        ];
      }),
    );

    return { events: allEventArrays.flat() };
  },
};
