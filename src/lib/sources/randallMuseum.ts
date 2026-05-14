import ical from "node-ical";
import { RRule } from "rrule";
import type { SourceDefinition, NormalizedEvent } from "../types";

// Randall Museum — a free city-run children's museum in Corona Heights, SF.
// Their All-in-One Event Calendar (Wordpress) plugin exposes a clean iCal feed.
// Most events recur weekly on Saturdays (Saturday Science, Afternoon Art, Meet
// an Animal Ambassador); we expand RRULE-based events into individual instances
// within the next 45 days. Special one-off events come through as-is.

const FEED_URL = "https://randallmuseum.org/?plugin=all-in-one-event-calendar&controller=ai1ec_exporter_controller&action=export_events";

const LOCATION = "Randall Museum, 199 Museum Way, San Francisco";
const LAT = 37.7660;
const LNG = -122.4378;
const URL = "https://randallmuseum.org/events-calendar/";

const LOOKAHEAD_DAYS = 45;

// Most Randall events are open to families; a few are adult-oriented (Lectures,
// some Theater shows). Strip those by category.
const ADULT_ONLY_CATEGORIES = new Set(["Lectures"]);

function isFamilyEvent(categories: string[], summary: string): boolean {
  if (categories.some((c) => ADULT_ONLY_CATEGORIES.has(c))) return false;
  // "Workshop" categories include adult workshops (e.g. printmaking) — only keep
  // if the title explicitly indicates kids/families.
  const onlyAdultWorkshop = categories.length === 1 && categories[0] === "Workshop";
  if (onlyAdultWorkshop) {
    return /famil|kid|child|youth|teen|all ages/i.test(summary);
  }
  return true;
}

function parseCategories(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === "string") return raw.split(",").map((s) => s.trim());
  return [];
}

export const randallMuseumSource: SourceDefinition = {
  id: "randallMuseum",
  name: "Randall Museum",
  description: "Saturday Science, Afternoon Art, Animal Ambassador & special events",
  async fetch() {
    const res = await fetch(FEED_URL, {
      headers: { "User-Agent": "mv-kids" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Randall Museum HTTP ${res.status}`);
    const ics = await res.text();
    const parsed = ical.sync.parseICS(ics);

    const now = new Date();
    const windowEnd = new Date(now.getTime() + LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);

    const events: NormalizedEvent[] = [];
    const seen = new Set<string>();

    for (const key of Object.keys(parsed)) {
      const v = parsed[key];
      if (v.type !== "VEVENT") continue;
      const vAny = v as unknown as Record<string, unknown>;
      const summary = (vAny.summary as string | undefined) ?? "";
      if (!summary || /^cancel/i.test(summary)) continue;

      const categories = parseCategories(vAny.categories);
      if (!isFamilyEvent(categories, summary)) continue;

      const description = ((vAny.description as string | undefined) ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\\n/g, "\n")
        .replace(/\\,/g, ",")
        .trim()
        .slice(0, 600);

      const url = (vAny.url as string | undefined) ?? URL;
      const baseStart = vAny.start as Date | undefined;
      const baseEnd = vAny.end as Date | undefined;
      if (!baseStart) continue;
      const durationMs = baseEnd ? baseEnd.getTime() - baseStart.getTime() : 60 * 60 * 1000;
      const baseUid = (vAny.uid as string) ?? key;

      const rrule = vAny.rrule as { options?: unknown } | undefined;

      const occurrences: Date[] = [];
      if (rrule && typeof rrule === "object" && rrule.options) {
        // node-ical attaches an rrule instance — expand it into our lookahead window.
        try {
          const rule = new RRule(rrule.options as ConstructorParameters<typeof RRule>[0]);
          const between = rule.between(now, windowEnd, true);
          occurrences.push(...between);
        } catch {
          // Malformed RRULE — fall back to base date if it's still upcoming.
          if (baseStart >= now && baseStart <= windowEnd) occurrences.push(baseStart);
        }
      } else {
        if (baseStart >= now && baseStart <= windowEnd) occurrences.push(baseStart);
      }

      for (const occStart of occurrences) {
        const occEnd = new Date(occStart.getTime() + durationMs);
        const externalId = `${baseUid}@${occStart.toISOString().slice(0, 16)}`;
        if (seen.has(externalId)) continue;
        seen.add(externalId);

        events.push({
          sourceId: "randallMuseum",
          externalId,
          title: summary,
          description,
          startAt: occStart,
          endAt: occEnd,
          location: LOCATION,
          lat: LAT,
          lng: LNG,
          ageMinMonths: 0,
          ageMaxMonths: 144,
          indoorness: "indoor",
          cost: "free",
          registration: "walk-in",
          scheduleLabel: null,
          url,
          evergreen: false,
        });
      }
    }

    return { events };
  },
};
