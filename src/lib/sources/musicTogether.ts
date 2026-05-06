import type { SourceDefinition, NormalizedEvent } from "../types";

interface MtCenter {
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

export const musicTogetherSource: SourceDefinition = {
  id: "music-together",
  name: "Music Together",
  description: "Music Together classes near Mountain View",
  async fetch() {
    const body = new URLSearchParams({
      locator_country: "United States",
      zip: "94041",
      address: "Mountain View, CA",
      distance_range: "20",
    });

    const res = await fetch("https://www.musictogether.com/classes/find_locations", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/javascript, */*",
        "X-Requested-With": "XMLHttpRequest",
        "Referer": "https://www.musictogether.com/class-locator",
        "User-Agent": "Mozilla/5.0 (compatible; mv-kids-bot/1.0)",
      },
      body: body.toString(),
    });

    if (!res.ok) throw new Error(`Music Together fetch failed: ${res.status}`);

    const data = await res.json() as { results?: MtCenter[] };
    const centers = data.results ?? [];

    const events: NormalizedEvent[] = centers.map((c) => {
      const fullAddress = `${c.address}, ${c.city}, ${c.state} ${c.zipcode}`;
      const url = c.website?.startsWith("http") ? c.website : `https://${c.website}`;
      return {
        sourceId: "music-together",
        externalId: c.class_code,
        title: `Music Together — ${c.center_name}`,
        description: `Music Together classes for babies, toddlers, and preschoolers (ages 0–5) with a caregiver. Semester-based mixed-age music program. Located in ${c.city}.`,
        startAt: new Date(),
        endAt: null,
        location: fullAddress,
        lat: parseFloat(c.lat) || null,
        lng: parseFloat(c.long) || null,
        ageMinMonths: 0,
        ageMaxMonths: 60,
        indoorness: "indoor",
        cost: "paid",
        registration: "required",
        scheduleLabel: null,
        url: url || null,
        evergreen: true,
        raw: c,
      };
    });

    return { events };
  },
};
