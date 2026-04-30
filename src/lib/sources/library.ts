import ical from "node-ical";
import type { SourceDefinition, NormalizedEvent, Indoorness } from "../types";

const FEED_URL = "https://mountainview.libcal.com/ical_subscribe.php?cid=8800";

// Mountain View Public Library: 585 Franklin St, Mountain View
const LIBRARY_LOCATION = { lat: 37.39067, lng: -122.08294 };

// Categories that are clearly kid-friendly. Library feed mixes adult/teen events.
const KID_CATEGORY_KEYWORDS = [
  "storytime",
  "youth",
  "children",
  "kids",
  "preschool",
  "toddler",
  "baby",
  "family",
  "stem",
  "steam",
  "summer reading",
];

// Keywords to actively exclude.
const EXCLUDE_KEYWORDS = [
  "esl",
  "citizenship",
  "adult",
  "senior",
  "teen ",
  "tween",
  "book club",
  "library closed",
  "holiday",
];

function isKidsEvent(summary: string, categories: string[] | undefined): boolean {
  const hay = (summary + " " + (categories ?? []).join(" ")).toLowerCase();
  if (EXCLUDE_KEYWORDS.some((k) => hay.includes(k))) return false;
  return KID_CATEGORY_KEYWORDS.some((k) => hay.includes(k));
}

function ageRangeFromText(text: string): {
  min: number | null;
  max: number | null;
} {
  // "ages 0-18 months", "ages 2-5", "preschoolers", etc.
  const t = text.toLowerCase();
  const monthMatch = t.match(/(\d+)\s*[-–]\s*(\d+)\s*months/);
  if (monthMatch) return { min: +monthMatch[1], max: +monthMatch[2] };
  const yearMatch = t.match(/ages?\s*(\d+)\s*[-–]\s*(\d+)/);
  if (yearMatch) return { min: +yearMatch[1] * 12, max: +yearMatch[2] * 12 };
  if (/\bbaby|babies|infant\b/.test(t)) return { min: 0, max: 18 };
  if (/\btoddler\b/.test(t)) return { min: 12, max: 36 };
  if (/\bpreschool/.test(t)) return { min: 36, max: 60 };
  if (/family|all ages/.test(t)) return { min: 0, max: 144 };
  return { min: null, max: null };
}

export const librarySource: SourceDefinition = {
  id: "library",
  name: "MV Public Library",
  description: "Storytimes & youth programs from LibCal",
  async fetch() {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "mv-kids" },
      // LibCal updates ~every 15min per X-PUBLISHED-TTL header
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Library feed HTTP ${res.status}`);
    const ics = await res.text();
    const parsed = ical.sync.parseICS(ics);

    const events: NormalizedEvent[] = [];
    for (const k of Object.keys(parsed)) {
      const v = parsed[k];
      if (v.type !== "VEVENT") continue;
      const vAny = v as unknown as Record<string, unknown>;
      const summary = (vAny.summary as string | undefined) ?? "";
      const rawCategories = vAny.categories;
      const categories = Array.isArray(rawCategories)
        ? (rawCategories as string[])
        : typeof rawCategories === "string"
        ? rawCategories.split(",").map((s) => s.trim())
        : undefined;
      if (!isKidsEvent(summary, categories)) continue;

      const desc = ((vAny.description as string | undefined) ?? "")
        .replace(/\\n/g, "\n")
        .replace(/\\,/g, ",")
        .trim();
      const haystack = summary + " " + desc;
      const { min, max } = ageRangeFromText(haystack);

      const location = (vAny.location as string | undefined) ?? "MV Public Library";
      const isOffsite = /offsite|park|magical bridge/i.test(location + " " + desc);

      events.push({
        sourceId: "library",
        externalId: (vAny.uid as string) ?? k,
        title: summary,
        description: desc.slice(0, 800),
        startAt: vAny.start as Date,
        endAt: (vAny.end as Date | undefined) ?? null,
        location,
        lat: isOffsite ? null : LIBRARY_LOCATION.lat,
        lng: isOffsite ? null : LIBRARY_LOCATION.lng,
        ageMinMonths: min,
        ageMaxMonths: max,
        indoorness: (isOffsite ? "outdoor" : "indoor") as Indoorness,
        url: (vAny.url as string | undefined) ?? null,
        evergreen: false,
      });
    }
    return { events };
  },
};
