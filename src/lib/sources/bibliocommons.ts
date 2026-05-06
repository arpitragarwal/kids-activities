import type { SourceDefinition, NormalizedEvent, Indoorness } from "../types";

// ─── RSS field extraction ─────────────────────────────────────────────────

function cdataText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`));
  return m ? m[1].trim() : "";
}

function plainText(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}(?:[^>]*)>([^<]*)</${tag}>`));
  return m ? m[1].trim() : "";
}

function allCdata(block: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "g");
  const out: string[] = [];
  let m;
  while ((m = re.exec(block)) !== null) out.push(m[1].trim());
  return out;
}

// ─── Kids category filters ────────────────────────────────────────────────

// Audience labels across Palo Alto, SCCL, SJPL, and Alameda County instances.
// Palo Alto uses: "Babies (under 2)", "Toddlers (18 mos. to 3 yrs)", "Pre-schoolers (3-5)", "Kids (6-11)"
// SCCL uses: "kids: babies", "kids: toddlers", "kids: preschoolers", "kids: grades k-8"
const KIDS_AUDIENCES = [
  "babies",          // matches "Babies (under 2)", "babies & toddlers", etc.
  "toddlers",
  "pre-schoolers",
  "preschoolers",
  "kids (6-11)",
  "kids: babies",
  "kids: toddlers",
  "kids: preschoolers",
  "kids: grades k-8",
  "kids: grades 5-8",
  "kids: family events",
  "kids storytimes",
  "storytime",
  "families",
  // "family" omitted — too broad, matches "Family Learning Centers" (adult ESL program)
];

const ADULT_ONLY_AUDIENCES = ["adults", "seniors", "teens (", "tweens", "grades 9-12", "family learning"];

function isKidsEvent(categories: string[]): boolean {
  const cats = categories.map((c) => c.toLowerCase());
  const hasKids = KIDS_AUDIENCES.some((kw) => cats.some((c) => c.includes(kw)));
  if (hasKids) return true; // all-ages events tagged for multiple audiences still pass
  // No kids audience at all — exclude adult/teen-only events
  return !ADULT_ONLY_AUDIENCES.some((ex) => cats.some((c) => c.includes(ex)));
}

// Per-category age ranges. Takes the UNION across all matching categories so an
// event tagged Babies + Toddlers + Pre-schoolers gets 0–60, not just 18–36.
const AGE_PATTERNS: Array<{ test: (s: string) => boolean; min: number; max: number }> = [
  { test: (s) => s.includes("babies & toddlers (0-18"),                              min: 0,   max: 18  },
  { test: (s) => s.includes("babies (under 2)"),                                     min: 0,   max: 24  },
  { test: (s) => s.includes("kids: babies"),                                          min: 0,   max: 12  },
  // general "babies" — only when not already covered by a more specific pattern above
  { test: (s) => s.includes("babies") && !s.includes("kids:") && !s.includes("& toddlers"), min: 0, max: 24 },
  { test: (s) => s.includes("toddlers (18 mos"),          min: 18,  max: 36  },
  { test: (s) => s.includes("toddlers (18"),              min: 18,  max: 36  },
  { test: (s) => s.includes("kids: toddlers"),            min: 12,  max: 36  },
  { test: (s) => s.includes("pre-schoolers (3-5)"),       min: 36,  max: 60  },
  { test: (s) => s.includes("preschoolers (3-5)"),        min: 36,  max: 60  },
  { test: (s) => s.includes("kids: preschoolers"),        min: 36,  max: 60  },
  { test: (s) => s.includes("kids (6-11)"),               min: 72,  max: 132 },
  { test: (s) => s.includes("kids: grades k-8"),          min: 60,  max: 168 },
  { test: (s) => s.includes("kids: grades 5-8"),          min: 120, max: 168 },
  { test: (s) => s.includes("kids: family") || s.includes("famil"), min: 0, max: 144 },
];

function ageRangeFromCategories(categories: string[]): { min: number | null; max: number | null } {
  const cats = categories.map((c) => c.toLowerCase());
  let min: number | null = null;
  let max: number | null = null;
  for (const cat of cats) {
    for (const p of AGE_PATTERNS) {
      if (p.test(cat)) {
        min = min === null ? p.min : Math.min(min, p.min);
        max = max === null ? p.max : Math.max(max, p.max);
      }
    }
  }
  return { min, max };
}

// ─── Factory ──────────────────────────────────────────────────────────────

interface BiblioCommonsConfig {
  id: string;
  name: string;
  domain: string;              // e.g. "paloalto", "sccl"
  defaultLat: number;
  defaultLng: number;
  /** If set, only include events at these branch names (substring match). */
  branchFilter?: string[];
}

export function makeBiblioCommonsSource(cfg: BiblioCommonsConfig): SourceDefinition {
  const FEED_URL = `https://gateway.bibliocommons.com/v2/libraries/${cfg.domain}/rss/events?size=200`;

  return {
    id: cfg.id,
    name: cfg.name,
    description: `Kids programs from ${cfg.name} (BiblioCommons RSS)`,
    async fetch() {
      const res = await fetch(FEED_URL, {
        headers: { "User-Agent": "mv-kids" },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`BiblioCommons RSS HTTP ${res.status}`);
      const xml = await res.text();

      // Split into <item> blocks
      const rawItems = xml.split("<item>").slice(1).map((s) => s.split("</item>")[0]);

      const events: NormalizedEvent[] = [];
      for (const item of rawItems) {
        // Skip cancelled events
        if (plainText(item, "bc:is_cancelled") === "true") continue;

        const categories = allCdata(item, "category");
        if (!isKidsEvent(categories)) continue;

        // Branch filter for systems that span many cities (e.g. SCCL)
        if (cfg.branchFilter) {
          const branchName = plainText(item, "bc:name");
          const inScope = cfg.branchFilter.some((b) =>
            branchName.toLowerCase().includes(b.toLowerCase()),
          );
          if (!inScope) continue;
        }

        const title = cdataText(item, "title");
        const description = cdataText(item, "description")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 800);
        const url = plainText(item, "link") || plainText(item, "guid");

        // Dates — use local timestamps (Pacific)
        const startLocal = plainText(item, "bc:start_date_local"); // "2026-05-01T16:00"
        const endLocal = plainText(item, "bc:end_date_local");
        if (!startLocal) continue;
        const startAt = new Date(startLocal + ":00-07:00");
        const endAt = endLocal ? new Date(endLocal + ":00-07:00") : null;
        if (Number.isNaN(startAt.getTime())) continue;

        // Location
        const locationBlock = item.match(/<bc:location>([\s\S]*?)<\/bc:location>/)?.[1] ?? "";
        const isVirtual = plainText(item, "bc:is_virtual") === "true";
        const branchName = plainText(locationBlock, "bc:name");
        const street = plainText(locationBlock, "bc:street");
        const city = plainText(locationBlock, "bc:city");
        const locationLabel = [branchName, street, city].filter(Boolean).join(", ") || cfg.name;
        const latStr = plainText(locationBlock, "bc:latitude");
        const lngStr = plainText(locationBlock, "bc:longitude");
        const lat = !isVirtual && latStr ? parseFloat(latStr) : cfg.defaultLat;
        const lng = !isVirtual && lngStr ? parseFloat(lngStr) : cfg.defaultLng;

        const registrationRequired =
          plainText(item.match(/<bc:registration_info>([\s\S]*?)<\/bc:registration_info>/)?.[1] ?? "", "bc:is_required") === "true";

        const { min, max } = ageRangeFromCategories(categories);

        const uid = url.split("/").pop() ?? `${cfg.id}-${startLocal}`;

        events.push({
          sourceId: cfg.id,
          externalId: uid,
          title,
          description,
          startAt,
          endAt,
          location: locationLabel,
          lat: isVirtual ? null : lat,
          lng: isVirtual ? null : lng,
          ageMinMonths: min,
          ageMaxMonths: max,
          indoorness: "indoor" as Indoorness,
          cost: "free",
          registration: registrationRequired ? "required" : "walk-in",
          scheduleLabel: null,
          url: url || null,
          evergreen: false,
        });
      }

      return { events };
    },
  };
}

// ─── Library instances ────────────────────────────────────────────────────

export const paloAltoLibrarySource = makeBiblioCommonsSource({
  id: "paloAltoLibrary",
  name: "Palo Alto City Library",
  domain: "paloalto",
  defaultLat: 37.4419,
  defaultLng: -122.1430,
});

// Santa Clara County Library District — South Bay branches.
export const scclLibrarySource = makeBiblioCommonsSource({
  id: "scclLibrary",
  name: "Santa Clara County Library",
  domain: "sccl",
  defaultLat: 37.3220,
  defaultLng: -122.0441,
  branchFilter: ["Cupertino Library", "Los Altos Library", "Milpitas Library", "Campbell Library"],
});

// San Jose Public Library
export const sanJoseLibrarySource = makeBiblioCommonsSource({
  id: "sanJoseLibrary",
  name: "San Jose Public Library",
  domain: "sjpl",
  defaultLat: 37.3355,
  defaultLng: -121.8864,
});

// Alameda County Library — covers Fremont, Newark, Union City
export const alamedaCountyLibrarySource = makeBiblioCommonsSource({
  id: "alamedaCountyLibrary",
  name: "Alameda County Library",
  domain: "aclibrary",
  defaultLat: 37.5523,
  defaultLng: -121.9887,
});

// San Mateo County Library — covers Peninsula cities
export const sanMateoCountyLibrarySource = makeBiblioCommonsSource({
  id: "sanMateoCountyLibrary",
  name: "San Mateo County Library",
  domain: "smcl",
  defaultLat: 37.5630,
  defaultLng: -122.3255,
});
