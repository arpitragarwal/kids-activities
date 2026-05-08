import type { SourceDefinition, NormalizedEvent } from "../types";

// ─── Shared types ─────────────────────────────────────────────────────────

interface PatternDate {
  weekdays: string;
  starting_time: string; // HH:mm:ss
  ending_time: string;
}
interface ActivityPattern {
  beginning_date: string;
  ending_date: string;
  pattern_dates: PatternDate[];
}
interface MeetingAndRegDates {
  activity_patterns: ActivityPattern[];
  no_meeting_dates: boolean;
}
interface ActivityItem {
  id: number;
  name: string;
  desc: string;
  detail_url: string;
  date_range_start: string;
  date_range_end: string;
  age_min_year: number;
  age_min_month: number;
  age_max_year: number;
  age_max_month: number;
  age_description: string;
  location: { label: string };
  number: string;
  search_from_price: number | null;
  allow_drop_in_reg: boolean;
}

// ─── Shared utilities ─────────────────────────────────────────────────────

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function fmtTime(hms: string): string {
  const [h, m] = hms.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function buildScheduleLabel(data: MeetingAndRegDates | null): string | null {
  if (!data || data.no_meeting_dates) return null;
  const allPatterns = data.activity_patterns?.flatMap((p) => p.pattern_dates) ?? [];
  if (allPatterns.length === 0) return null;
  const byTime = new Map<string, Set<string>>();
  for (const p of allPatterns) {
    const key = `${p.starting_time}|${p.ending_time}`;
    if (!byTime.has(key)) byTime.set(key, new Set());
    byTime.get(key)!.add(p.weekdays);
  }
  const parts: string[] = [];
  for (const [key, days] of byTime) {
    const [startT, endT] = key.split("|");
    const sortedDays = [...days].sort(
      (a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b),
    );
    parts.push(`${sortedDays.join(", ")} · ${fmtTime(startT)}–${fmtTime(endT)}`);
  }
  return parts.join(" / ");
}

async function fetchScheduleLabel(slug: string, id: number): Promise<string | null> {
  try {
    const url = `https://anc.apm.activecommunities.com/${slug}/rest/activity/detail/meetingandregistrationdates/${id}?locale=en-US`;
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "mv-kids" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      body?: { meeting_and_registration_dates?: MeetingAndRegDates };
    };
    return buildScheduleLabel(json.body?.meeting_and_registration_dates ?? null);
  } catch {
    return null;
  }
}

async function pMap<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

const monthsFromYM = (y: number, m: number) => y * 12 + m;

// ─── Factory ──────────────────────────────────────────────────────────────

interface CityRecConfig {
  id: string;
  name: string;
  slug: string;
  defaultLat: number;
  defaultLng: number;
  venueCoords: Record<string, { lat: number; lng: number }>;
}

function makeCityRecSource(cfg: CityRecConfig): SourceDefinition {
  const API_URL = `https://anc.apm.activecommunities.com/${cfg.slug}/rest/activities/list?locale=en-US`;

  function coordsForVenue(label: string): { lat: number; lng: number } {
    const k = label.toLowerCase();
    for (const [name, c] of Object.entries(cfg.venueCoords)) {
      if (k.includes(name)) return c;
    }
    return { lat: cfg.defaultLat, lng: cfg.defaultLng };
  }

  return {
    id: cfg.id,
    name: cfg.name,
    description: `Drop-in & registered classes for kids 0-5 (ActiveNet – ${cfg.name})`,
    async fetch() {
      const allItems: ActivityItem[] = [];
      let page = 1;
      while (page <= 8) {
        const res = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "mv-kids",
            page_info: JSON.stringify({
              order_by: "Beginning Date",
              page_number: page,
              total_records_per_page: 50,
            }),
          },
          body: JSON.stringify({
            activity_search_pattern: {
              skills: [],
              time_after_str: "",
              days_of_week: null,
              activity_select_param: 2,
              center_ids: [],
              time_before_str: "",
              open_spots: null,
              activity_id: null,
              activity_category_ids: [],
              date_before: "",
              min_age: 0,
              max_age: 6,
              date_after: "",
              activity_type_ids: [],
              site_ids: [],
              for_map: false,
              geographic_area_ids: [],
              season_ids: [],
              activity_department_ids: [],
              activity_other_category_ids: [],
              child_season_ids: [],
              activity_keyword: "",
              instructor_ids: [],
              sub_category_ids: [],
              customer_ids: [],
              activity_id_list: null,
              date_picker: null,
              after_school_program: null,
              display_closed_activities: false,
              is_search_open_activities: false,
            },
            activity_transfer_pattern: {},
          }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`ActiveNet HTTP ${res.status}`);
        const json = (await res.json()) as {
          body: { activity_items: ActivityItem[] };
          headers: { page_info: { total_page: number } };
        };
        allItems.push(...(json.body.activity_items ?? []));
        if (page >= (json.headers?.page_info?.total_page ?? 1)) break;
        page++;
      }

      const now = Date.now();
      const kept = allItems.filter((a) => {
        const ageMin = monthsFromYM(a.age_min_year ?? 0, a.age_min_month ?? 0);
        if (ageMin > 60) return false;
        if (!a.date_range_start || !a.date_range_end) return false;
        const end = new Date(a.date_range_end + "T23:59:59-08:00");
        const start = new Date(a.date_range_start + "T09:00:00-08:00");
        if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return false;
        if (end.getTime() < now) return false;
        return true;
      });

      const labels = await pMap(kept, 8, (a) => fetchScheduleLabel(cfg.slug, a.id));

      const events: NormalizedEvent[] = kept.map((a, i) => {
        const ageMin = monthsFromYM(a.age_min_year ?? 0, a.age_min_month ?? 0);
        const ageMax = monthsFromYM(a.age_max_year ?? 0, a.age_max_month ?? 0);
        const end = new Date(a.date_range_end + "T23:59:59-08:00");
        const start = new Date(a.date_range_start + "T09:00:00-08:00");
        const venue = a.location?.label ?? "";
        const { lat, lng } = coordsForVenue(venue);
        const desc = a.desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);
        const cost: string =
          typeof a.search_from_price === "number" && a.search_from_price > 0
            ? `$${a.search_from_price}+`
            : a.search_from_price === 0
            ? "free"
            : "paid";

        return {
          sourceId: cfg.id,
          externalId: String(a.id),
          title: a.name,
          description: `${a.age_description} · ${venue}\n\n${desc}`,
          startAt: start,
          endAt: end,
          location: venue,
          lat,
          lng,
          ageMinMonths: ageMin,
          ageMaxMonths: ageMax || null,
          indoorness: /pool|aquatic|swim/i.test(a.name)
            ? "outdoor"
            : /park/i.test(venue)
            ? "outdoor"
            : "indoor",
          cost,
          registration: a.allow_drop_in_reg ? "drop-in" : "required",
          scheduleLabel: labels[i],
          url: a.detail_url,
          evergreen: true,
        };
      });
      return { events };
    },
  };
}

// ─── City instances ────────────────────────────────────────────────────────

// Mountain View
export const cityRecSource = makeCityRecSource({
  id: "cityRec",
  name: "City of MV Recreation",
  slug: "mountainviewrecreation",
  defaultLat: 37.3861,
  defaultLng: -122.0839,
  venueCoords: {
    "mountain view community center": { lat: 37.4014, lng: -122.105 },
    "rengstorff park":                { lat: 37.4014, lng: -122.105 },
    "rengstorff house":               { lat: 37.4014, lng: -122.105 },
    "rengstorff aquatic center":      { lat: 37.402,  lng: -122.105 },
    "eagle park":                     { lat: 37.4036, lng: -122.0814 },
    "mckelvey park":                  { lat: 37.3858, lng: -122.0568 },
    "stevenson park":                 { lat: 37.4042, lng: -122.0939 },
    "cuesta park":                    { lat: 37.3766, lng: -122.0681 },
    "cmty school of music and arts":  { lat: 37.4032, lng: -122.0805 },
    "shoreline park":                 { lat: 37.4271, lng: -122.0807 },
  },
});

export const santaClaraRecSource = makeCityRecSource({
  id: "santaClaraRec",
  name: "City of Santa Clara Recreation",
  slug: "santaclara",
  defaultLat: 37.3541,
  defaultLng: -121.9552,
  venueCoords: {
    "community recreation center":    { lat: 37.3499, lng: -121.9671 },
    "crc":                            { lat: 37.3499, lng: -121.9671 },
    "youth & teen center":            { lat: 37.3499, lng: -121.9671 },
    "youth & teen ctr":               { lat: 37.3499, lng: -121.9671 },
    "lawrence station":               { lat: 37.3765, lng: -121.9785 },
  },
});

export const cupertinoRecSource = makeCityRecSource({
  id: "cupertinoRec",
  name: "City of Cupertino Recreation",
  slug: "cupertino",
  defaultLat: 37.3230,
  defaultLng: -122.0322,
  venueCoords: {
    "quinlan":                        { lat: 37.3218, lng: -122.0436 },
    "monta vista rec":                { lat: 37.3195, lng: -122.0602 },
    "jollyman park":                  { lat: 37.3175, lng: -122.0444 },
    "growing iq":                     { lat: 37.3228, lng: -122.0162 },
  },
});

// San Jose
export const sanJoseRecSource = makeCityRecSource({
  id: "sanJoseRec",
  name: "City of San Jose Recreation",
  slug: "sanjoseparksandrec",
  defaultLat: 37.3382,
  defaultLng: -121.8863,
  venueCoords: {
    "almaden":                        { lat: 37.2436, lng: -121.8876 },
    "berryessa":                      { lat: 37.3747, lng: -121.8500 },
    "camden":                         { lat: 37.2601, lng: -121.9398 },
    "willow glen":                    { lat: 37.3082, lng: -121.8855 },
    "alum rock":                      { lat: 37.3721, lng: -121.8266 },
    "communications hill":            { lat: 37.2910, lng: -121.8572 },
    "kelley park":                    { lat: 37.3186, lng: -121.8449 },
  },
});

// San Francisco
export const sfRecSource = makeCityRecSource({
  id: "sfRec",
  name: "SF Recreation & Parks",
  slug: "sfrecpark",
  defaultLat: 37.7749,
  defaultLng: -122.4194,
  venueCoords: {
    "mission":                        { lat: 37.7644, lng: -122.4194 },
    "richmond":                       { lat: 37.7786, lng: -122.4780 },
    "sunset":                         { lat: 37.7500, lng: -122.4900 },
    "marina":                         { lat: 37.8023, lng: -122.4393 },
    "potrero":                        { lat: 37.7572, lng: -122.4031 },
    "excelsior":                      { lat: 37.7219, lng: -122.4364 },
    "chinatown":                      { lat: 37.7941, lng: -122.4078 },
    "visitacion valley":              { lat: 37.7145, lng: -122.4086 },
  },
});

// Fremont
export const fremontRecSource = makeCityRecSource({
  id: "fremontRec",
  name: "City of Fremont Recreation",
  slug: "fremont",
  defaultLat: 37.5485,
  defaultLng: -121.9886,
  venueCoords: {
    "lake elizabeth":                 { lat: 37.5605, lng: -122.0069 },
    "central park":                   { lat: 37.5485, lng: -121.9886 },
    "niles":                          { lat: 37.5757, lng: -121.9769 },
    "irvington":                      { lat: 37.5261, lng: -121.9625 },
    "warm springs":                   { lat: 37.4979, lng: -121.9285 },
  },
});

// Milpitas
export const milpitasRecSource = makeCityRecSource({
  id: "milpitasRec",
  name: "City of Milpitas Recreation",
  slug: "milpitasrec",
  defaultLat: 37.4323,
  defaultLng: -121.8996,
  venueCoords: {
    "milpitas community center":      { lat: 37.4358, lng: -121.8987 },
    "sr. center":                     { lat: 37.4358, lng: -121.8987 },
    "library":                        { lat: 37.4368, lng: -121.9002 },
  },
});

// Redwood City
export const redwoodCityRecSource = makeCityRecSource({
  id: "redwoodCityRec",
  name: "City of Redwood City Recreation",
  slug: "rwcpark",
  defaultLat: 37.4852,
  defaultLng: -122.2364,
  venueCoords: {
    "stulsaft":                       { lat: 37.4869, lng: -122.2259 },
    "veterans":                       { lat: 37.4852, lng: -122.2366 },
    "downtown":                       { lat: 37.4852, lng: -122.2364 },
    "jersey":                         { lat: 37.4929, lng: -122.2158 },
  },
});

// Daly City
export const dalyCityRecSource = makeCityRecSource({
  id: "dalyCityRec",
  name: "City of Daly City Recreation",
  slug: "dalycity",
  defaultLat: 37.6879,
  defaultLng: -122.4702,
  venueCoords: {
    "daly city community center":     { lat: 37.6759, lng: -122.4631 },
    "community center":               { lat: 37.6759, lng: -122.4631 },
    "doelger":                        { lat: 37.6928, lng: -122.4726 },
  },
});

// Sunnyvale — may be blocked by Akamai on residential IPs; expected to work on Vercel
export const sunnyvaleRecSource = makeCityRecSource({
  id: "sunnyvaleRec",
  name: "City of Sunnyvale Recreation",
  slug: "sunnyvaleactivities",
  defaultLat: 37.3688,
  defaultLng: -122.0363,
  venueCoords: {
    "sunnyvale community center":     { lat: 37.3667, lng: -122.0160 },
    "sunnyvale sports center":        { lat: 37.3625, lng: -122.0230 },
    "las palmas":                     { lat: 37.3740, lng: -121.9934 },
    "columbia":                       { lat: 37.3748, lng: -121.9940 },
    "washington":                     { lat: 37.3823, lng: -122.0384 },
    "lakewood":                       { lat: 37.3575, lng: -122.0171 },
    "ponderosa":                      { lat: 37.3493, lng: -122.0048 },
  },
});
