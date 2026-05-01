import { addDays, startOfDay, endOfDay } from "date-fns";
import { fetchEventsBetween, rank } from "@/lib/rank";
import type { RankedEvent } from "@/lib/rank";
import { getCachedWeather, summarizeForHour } from "@/lib/weather";
import { formatInTimeZone } from "date-fns-tz";
import { config } from "@/lib/config";
import { getSourceHealth } from "@/lib/sources";
import { getEffectiveConfig } from "@/lib/userPrefs";
import { parseScheduleLabel } from "@/lib/schedule";
import { ContextHeader } from "@/components/ContextHeader";
import { EventList } from "@/components/EventList";
import type { DayData } from "@/components/EventList";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOW_ABBR = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function computeTopPicks(events: RankedEvent[]): { topPicks: RankedEvent[]; rest: RankedEvent[] } {
  const topPicks: RankedEvent[] = [];
  const usedBuckets = new Set<string>();
  for (const e of events) {
    if (topPicks.length >= 3) break;
    const bucket = `${e.source_id}:${e.indoorness}`;
    if (usedBuckets.has(bucket)) continue;
    topPicks.push(e);
    usedBuckets.add(bucket);
  }
  if (topPicks.length < 3) {
    const pickedIds = new Set(topPicks.map((e) => `${e.source_id}:${e.external_id}`));
    for (const e of events) {
      if (topPicks.length >= 3) break;
      if (pickedIds.has(`${e.source_id}:${e.external_id}`)) continue;
      topPicks.push(e);
    }
  }
  const topPickIds = new Set(topPicks.map((e) => `${e.source_id}:${e.external_id}`));
  return {
    topPicks,
    rest: events.filter((e) => !topPickIds.has(`${e.source_id}:${e.external_id}`)),
  };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const now = new Date();
  const cfg = await getEffectiveConfig();
  const params = await searchParams;
  const start = startOfDay(now);
  const end = endOfDay(addDays(now, 6));

  const [{ periods, fetchedAt }, dbEvents, health] = await Promise.all([
    getCachedWeather(),
    fetchEventsBetween(start, end),
    getSourceHealth(),
  ]);

  const ranked = rank(dbEvents, {
    at: now,
    weather: periods,
    childAgeMonths: cfg.child.ageMonths,
    home: cfg.home,
  });

  // Build 7-day buckets.
  const dayDates: Date[] = [];
  const dayKeys: string[] = [];
  const buckets = new Map<string, RankedEvent[]>();

  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const k = formatInTimeZone(d, config.timezone, "EEE MMM d");
    dayDates.push(d);
    dayKeys.push(k);
    buckets.set(k, []);
  }

  for (const e of ranked) {
    if (!e.evergreen) {
      const k = formatInTimeZone(new Date(e.start_at), config.timezone, "EEE MMM d");
      buckets.get(k)?.push(e);
      continue;
    }
    if (e.source_id === "cityRec" && e.schedule_label) {
      const sched = parseScheduleLabel(e.schedule_label);
      if (sched.days.length > 0) {
        for (let i = 0; i < dayDates.length; i++) {
          if (sched.days.includes(dayDates[i].getDay())) {
            buckets.get(dayKeys[i])!.push(e);
          }
        }
        continue;
      }
    }
    // Anytime (parks, walk-in venues) — show on every day
    for (const k of dayKeys) {
      buckets.get(k)!.push(e);
    }
  }

  const days: DayData[] = dayDates.map((d, i) => {
    const k = dayKeys[i];
    const events = buckets.get(k) ?? [];
    const { topPicks, rest } = computeTopPicks(events);
    return {
      label: k,
      abbr: DOW_ABBR[d.getDay()],
      num: d.getDate(),
      topPicks,
      rest,
    };
  });

  const broken = health.filter(
    (h) => h.status === "broken" || h.status === "stale",
  );

  const wx = summarizeForHour(periods, now);
  const dateLabel = formatInTimeZone(now, config.timezone, "EEE MMM d");
  const currentTime = formatInTimeZone(now, config.timezone, "h:mm a");

  const totalEvents = days[0].topPicks.length + days[0].rest.length;

  return (
    <main>
      <ContextHeader
        wx={wx}
        fetchedAt={fetchedAt}
        dateLabel={dateLabel}
        currentTime={currentTime}
        cfg={cfg}
        status={params.status}
        error={params.error}
      />

      {broken.length > 0 && (
        <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 mb-5 text-sm text-amber-900">
          <span className="text-base leading-none mt-0.5">⚠️</span>
          <div>
            <span className="font-medium">
              {broken.length} source{broken.length === 1 ? "" : "s"} need attention
            </span>{" "}
            —{" "}
            <Link href="/health" className="underline underline-offset-2">
              view source health →
            </Link>
          </div>
        </div>
      )}

      {totalEvents === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-xl p-10 text-center bg-white">
          <p className="text-stone-500 font-medium">No events yet — has the cron run?</p>
          <p className="mt-2 text-xs text-stone-400">
            Hit{" "}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
              /api/refresh
            </code>{" "}
            to populate.
          </p>
        </div>
      ) : (
        <EventList
          days={days}
          childAgeMonths={cfg.child.ageMonths}
          homeLat={cfg.home.lat}
          homeLng={cfg.home.lng}
        />
      )}
    </main>
  );
}
