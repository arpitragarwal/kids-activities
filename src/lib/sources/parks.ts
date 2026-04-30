import type { SourceDefinition, NormalizedEvent } from "../types";

// Curated list of Mountain View kid-friendly parks & places. Evergreen entries.
// Update freely — these are facts about geography, not scraped data.
interface Park {
  id: string;
  name: string;
  lat: number;
  lng: number;
  description: string;
  ageMinMonths: number;
  ageMaxMonths: number;
  indoorness: "indoor" | "outdoor";
  url?: string;
  // Tags used by ranking heuristics.
  tags: Array<
    "playground" | "splashPad" | "shade" | "stroller" | "library" | "indoor" | "trail" | "lake"
  >;
}

const PARKS: Park[] = [
  {
    id: "magical-bridge-rengstorff",
    name: "Magical Bridge Playground at Rengstorff Park",
    lat: 37.4014,
    lng: -122.105,
    description:
      "Fully accessible playground with sensory zones, swings, and a tot-friendly area. Restrooms onsite. Adjacent to the aquatic center.",
    ageMinMonths: 0,
    ageMaxMonths: 144,
    indoorness: "outdoor",
    url: "https://www.mountainview.gov/our-city/departments/community-services/parks-and-open-space/parks/rengstorff-park",
    tags: ["playground", "shade", "stroller"],
  },
  {
    id: "cuesta-park",
    name: "Cuesta Park",
    lat: 37.3766,
    lng: -122.0681,
    description:
      "Large shaded park with a great playground for toddlers, picnic areas, and big lawns. Bathrooms onsite.",
    ageMinMonths: 6,
    ageMaxMonths: 144,
    indoorness: "outdoor",
    tags: ["playground", "shade", "stroller"],
  },
  {
    id: "shoreline-park",
    name: "Shoreline at Mountain View",
    lat: 37.4271,
    lng: -122.0807,
    description:
      "Open lakefront park with paved paths great for strollers and balance bikes. Boat house cafe nearby. Limited shade — best on cooler days.",
    ageMinMonths: 0,
    ageMaxMonths: 144,
    indoorness: "outdoor",
    tags: ["lake", "stroller", "trail"],
  },
  {
    id: "eagle-park",
    name: "Eagle Park",
    lat: 37.4036,
    lng: -122.0814,
    description:
      "Neighborhood park near downtown. Small playground sized for younger kids. Pool onsite (seasonal).",
    ageMinMonths: 6,
    ageMaxMonths: 96,
    indoorness: "outdoor",
    tags: ["playground", "splashPad"],
  },
  {
    id: "mckelvey-park",
    name: "McKelvey Park",
    lat: 37.3858,
    lng: -122.0568,
    description:
      "Quiet park with toddler playground and a baseball field. Less crowded than Cuesta.",
    ageMinMonths: 12,
    ageMaxMonths: 96,
    indoorness: "outdoor",
    tags: ["playground", "shade"],
  },
  {
    id: "stevenson-park",
    name: "Stevenson Park",
    lat: 37.4042,
    lng: -122.0939,
    description:
      "Small neighborhood park with a playground. Good quick stop with a toddler.",
    ageMinMonths: 12,
    ageMaxMonths: 84,
    indoorness: "outdoor",
    tags: ["playground"],
  },
  {
    id: "stevens-creek-trail",
    name: "Stevens Creek Trail (Yuba Dr trailhead)",
    lat: 37.398,
    lng: -122.0606,
    description:
      "Paved trail along the creek — ideal for strollers, balance bikes, and short walks with toddlers.",
    ageMinMonths: 0,
    ageMaxMonths: 144,
    indoorness: "outdoor",
    tags: ["trail", "stroller", "shade"],
  },
  {
    id: "mvpl-childrens-room",
    name: "MV Public Library Children's Room",
    lat: 37.39067,
    lng: -122.08294,
    description:
      "Drop-in destination with picture books, puzzles, and play space. Always indoor — a reliable rainy-day pick.",
    ageMinMonths: 0,
    ageMaxMonths: 96,
    indoorness: "indoor",
    url: "https://library.mountainview.gov/",
    tags: ["library", "indoor"],
  },
];

export const parksSource: SourceDefinition = {
  id: "parks",
  name: "Parks & Places",
  description: "Curated MV parks, trails, and indoor spots",
  async fetch() {
    const events: NormalizedEvent[] = PARKS.map((p) => ({
      sourceId: "parks",
      externalId: p.id,
      title: p.name,
      description: p.description + "\n\nTags: " + p.tags.join(", "),
      // Evergreen — anchor startAt to today so it sorts as "available now".
      startAt: new Date(),
      endAt: null,
      location: p.name,
      lat: p.lat,
      lng: p.lng,
      ageMinMonths: p.ageMinMonths,
      ageMaxMonths: p.ageMaxMonths,
      indoorness: p.indoorness,
      cost: "free",
      registration: "walk-in",
      url: p.url ?? null,
      evergreen: true,
      raw: { tags: p.tags },
    }));
    return { events };
  },
};
