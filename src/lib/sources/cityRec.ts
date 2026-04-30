import type { SourceDefinition, NormalizedEvent } from "../types";

const API_URL =
  "https://anc.apm.activecommunities.com/mountainviewrecreation/rest/activities/list?locale=en-US";

interface ActivityItem {
  id: number;
  name: string;
  desc: string;
  detail_url: string;
  date_range_start: string; // YYYY-MM-DD
  date_range_end: string;
  age_min_year: number;
  age_min_month: number;
  age_max_year: number;
  age_max_month: number;
  age_description: string;
  location: { label: string };
  number: string;
}

// Approximate locations of MV recreation venues. Used when we can match by name.
const VENUE_COORDS: Record<string, { lat: number; lng: number }> = {
  "mountain view community center": { lat: 37.4014, lng: -122.105 },
  "rengstorff park": { lat: 37.4014, lng: -122.105 },
  "rengstorff house": { lat: 37.4014, lng: -122.105 },
  "rengstorff aquatic center": { lat: 37.402, lng: -122.105 },
  "eagle park": { lat: 37.4036, lng: -122.0814 },
  "mckelvey park": { lat: 37.3858, lng: -122.0568 },
  "stevenson park": { lat: 37.4042, lng: -122.0939 },
  "cuesta park": { lat: 37.3766, lng: -122.0681 },
  "cmty school of music and arts": { lat: 37.4032, lng: -122.0805 },
  "shoreline park": { lat: 37.4271, lng: -122.0807 },
};

function coordsForVenue(label: string): { lat: number | null; lng: number | null } {
  const k = label.toLowerCase();
  for (const [name, c] of Object.entries(VENUE_COORDS)) {
    if (k.includes(name)) return c;
  }
  return { lat: null, lng: null };
}

const monthsFromYM = (y: number, m: number) => y * 12 + m;

export const cityRecSource: SourceDefinition = {
  id: "cityRec",
  name: "City of MV Recreation",
  description: "Drop-in & registered classes for kids 0-5 (ActiveNet)",
  async fetch() {
    // Pull all activities matching age 0-5 via min_age/max_age. Paginate.
    const allItems: ActivityItem[] = [];
    let page = 1;
    const perPage = 50;
    // Cap pagination to avoid runaway loops.
    while (page <= 8) {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "mv-kids",
          page_info: JSON.stringify({
            order_by: "Beginning Date",
            page_number: page,
            total_records_per_page: perPage,
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
      allItems.push(...json.body.activity_items);
      if (page >= json.headers.page_info.total_page) break;
      page++;
    }

    const events: NormalizedEvent[] = [];
    const now = Date.now();
    for (const a of allItems) {
      // Filter to actual kids 0-5.
      const ageMin = monthsFromYM(a.age_min_year ?? 0, a.age_min_month ?? 0);
      const ageMax = monthsFromYM(a.age_max_year ?? 0, a.age_max_month ?? 0);
      if (ageMin > 60) continue; // start age >5yrs

      // Skip activities with missing/unparseable dates — ActiveNet sometimes
      // returns blank date_range_* on drop-ins or always-open programs.
      if (!a.date_range_start || !a.date_range_end) continue;
      const end = new Date(a.date_range_end + "T23:59:59-08:00");
      const start = new Date(a.date_range_start + "T09:00:00-08:00");
      if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) continue;
      if (end.getTime() < now) continue;
      const venue = a.location?.label ?? "";
      const { lat, lng } = coordsForVenue(venue);
      // Strip HTML from desc.
      const desc = a.desc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 800);

      // ActiveNet activities are series, not one-off events. Treat as evergreen
      // (rank surfaces them whenever within date range), but anchor startAt to
      // series start for sorting.
      events.push({
        sourceId: "cityRec",
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
        url: a.detail_url,
        evergreen: true,
      });
    }
    return { events };
  },
};
