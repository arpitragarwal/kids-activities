import ical from "node-ical";
import type { SourceDefinition, NormalizedEvent, Indoorness } from "../types";

// ─── Shared keyword filters ───────────────────────────────────────────────

const KID_CATEGORY_KEYWORDS = [
  "storytime", "youth", "children", "kids", "preschool",
  "toddler", "baby", "family", "stem", "steam", "summer reading",
];

const EXCLUDE_KEYWORDS = [
  "esl", "citizenship", "adult", "senior", "teen ",
  "tween", "book club", "library closed", "holiday",
];

function isKidsEvent(summary: string, categories: string[] | undefined): boolean {
  const hay = (summary + " " + (categories ?? []).join(" ")).toLowerCase();
  if (EXCLUDE_KEYWORDS.some((k) => hay.includes(k))) return false;
  return KID_CATEGORY_KEYWORDS.some((k) => hay.includes(k));
}

function ageRangeFromText(text: string): { min: number | null; max: number | null } {
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

// ─── Factory ──────────────────────────────────────────────────────────────

interface LibCalConfig {
  id: string;
  name: string;
  subdomain: string;  // e.g. "mountainview", "sunnyvale"
  cid: number;
  lat: number;
  lng: number;
  src?: string;  // optional src= param (e.g. "p" for public calendar feeds)
}

export function makeLibCalSource(cfg: LibCalConfig): SourceDefinition {
  const params = cfg.src ? `src=${cfg.src}&cid=${cfg.cid}` : `cid=${cfg.cid}`;
  const FEED_URL = `https://${cfg.subdomain}.libcal.com/ical_subscribe.php?${params}`;

  return {
    id: cfg.id,
    name: cfg.name,
    description: `Storytimes & youth programs from ${cfg.name} (LibCal)`,
    async fetch() {
      const res = await fetch(FEED_URL, {
        headers: { "User-Agent": "mv-kids" },
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
        if (/^cancel/i.test(summary)) continue;
        if (!isKidsEvent(summary, categories)) continue;

        const desc = ((vAny.description as string | undefined) ?? "")
          .replace(/\\n/g, "\n")
          .replace(/\\,/g, ",")
          .trim();
        const haystack = summary + " " + desc;
        const { min, max } = ageRangeFromText(haystack);

        const rawLocation = (vAny.location as string | undefined) ?? cfg.name;
        const isOffsite = /offsite|park|magical bridge/i.test(rawLocation + " " + desc);

        // "Offsite" is not useful to display — pull the real address from the description
        // e.g. "Find us at 201 S Rengstorff Ave" or "located at 123 Main St"
        let location = rawLocation;
        if (/^offsite$/i.test(rawLocation.trim())) {
          // Try two patterns:
          // 1. A bare street address like "201 S. Rengstorff Ave, Mountain View"
          // 2. A named place after "find us at / join us at / ..."
          const streetMatch = desc.match(
            /\b(\d+\s+[A-Za-z. ]+(?:Ave|St|Blvd|Dr|Rd|Way|Ln|Pl|Place|Circle|Ct)\.?(?:,\s*[A-Za-z ]+)?)/i,
          );
          const phraseMatch = desc.match(
            /(?:find us at|located at|we(?:'ll)? be at|join us at)\s+([^!.\n]{5,60})/i,
          );
          const extracted = streetMatch?.[1] ?? phraseMatch?.[1];
          if (extracted) location = extracted.replace(/[.,\s]+$/, "").trim();
        }

        const needsSignup =
          /registration is required|register (online|here|now|in advance|at)|please register|sign[- ]?up required|rsvp/i.test(desc);

        events.push({
          sourceId: cfg.id,
          externalId: (vAny.uid as string) ?? k,
          title: summary,
          description: desc.slice(0, 800),
          startAt: vAny.start as Date,
          endAt: (vAny.end as Date | undefined) ?? null,
          location,
          lat: isOffsite ? null : cfg.lat,
          lng: isOffsite ? null : cfg.lng,
          ageMinMonths: min,
          ageMaxMonths: max,
          indoorness: (isOffsite ? "outdoor" : "indoor") as Indoorness,
          cost: "free",
          registration: needsSignup ? "required" : "walk-in",
          scheduleLabel: null,
          url: (vAny.url as string | undefined) ?? null,
          evergreen: false,
        });
      }
      return { events };
    },
  };
}

// ─── Library instances ────────────────────────────────────────────────────

export const librarySource = makeLibCalSource({
  id: "library",
  name: "MV Public Library",
  subdomain: "mountainview",
  cid: 8800,
  lat: 37.39067,
  lng: -122.08294,
});

export const sunnyvaleLibrarySource = makeLibCalSource({
  id: "sunnyvaleLibrary",
  name: "Sunnyvale Public Library",
  subdomain: "sunnyvale",
  cid: 13025,
  lat: 37.3688,
  lng: -122.0363,
});

export const losGatosLibrarySource = makeLibCalSource({
  id: "losGatosLibrary",
  name: "Los Gatos Public Library",
  subdomain: "losgatosca",
  cid: 11830,
  lat: 37.2358,
  lng: -121.9625,
});

// San Mateo Public Library — Main Branch (55 W 3rd Ave, San Mateo)
export const sanMateoPublicLibraryKidsSource = makeLibCalSource({
  id: "sanMateoPublicLibraryKids",
  name: "San Mateo Public Library (Kids)",
  subdomain: "sanmateopublic",
  src: "p",
  cid: 16089,
  lat: 37.5629,
  lng: -122.3255,
});

export const sanMateoPublicLibrarySource = makeLibCalSource({
  id: "sanMateoPublicLibrary",
  name: "San Mateo Public Library",
  subdomain: "sanmateopublic",
  src: "p",
  cid: 12176,
  lat: 37.5629,
  lng: -122.3255,
});
