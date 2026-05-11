import { addDays, startOfDay, endOfDay } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
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

export const dynamic = "force-dynamic";
export const revalidate = 0;

const DOW_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  // Compute start/end in Pacific time so the week strip aligns with the user's day,
  // not UTC midnight (which is 5 PM Pacific and would show yesterday as "today").
  const todayPacific = formatInTimeZone(now, config.timezone, "yyyy-MM-dd");
  const start = fromZonedTime(`${todayPacific}T00:00:00`, config.timezone);
  const end = endOfDay(addDays(start, 29));

  // Find Monday of the current week (0=Sun…6=Sat → Mon offset).
  // start is Pacific midnight expressed as UTC, so getDay() returns the Pacific weekday.
  const dow = start.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1; // Mon=0 … Sun=6
  const weekMondayStart = addDays(start, -daysFromMonday);

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

  // Build 6-week (42-day) buckets starting from Monday of current week.
  const TOTAL_DAYS = 42;
  const dayDates: Date[] = [];
  const dayKeys: string[] = [];
  const buckets = new Map<string, RankedEvent[]>();

  for (let i = 0; i < TOTAL_DAYS; i++) {
    const d = addDays(weekMondayStart, i);
    const k = formatInTimeZone(d, config.timezone, "EEE MMM d");
    dayDates.push(d);
    dayKeys.push(k);
    buckets.set(k, []);
  }

  for (const e of ranked) {
    if (e.source_id === "parks") continue;
    if (!e.evergreen) {
      const k = formatInTimeZone(new Date(e.start_at), config.timezone, "EEE MMM d");
      buckets.get(k)?.push(e);
      continue;
    }
    if (e.source_id !== "parks" && e.schedule_label) {
      const sched = parseScheduleLabel(e.schedule_label);
      if (sched.days.length > 0) {
        const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        // Only show series on days that fall within its date-range window.
        // start_at = date_range_start at 9 AM PT; end_at = date_range_end at 23:59 PT.
        const seriesStart = formatInTimeZone(new Date(e.start_at), config.timezone, "yyyy-MM-dd");
        const seriesEnd = e.end_at
          ? formatInTimeZone(new Date(e.end_at), config.timezone, "yyyy-MM-dd")
          : null;
        for (let i = 0; i < dayDates.length; i++) {
          const abbr = new Intl.DateTimeFormat("en-US", { timeZone: config.timezone, weekday: "short" }).format(dayDates[i]);
          const dow = DOW[abbr] ?? dayDates[i].getDay();
          if (sched.days.includes(dow)) {
            const dayStr = formatInTimeZone(dayDates[i], config.timezone, "yyyy-MM-dd");
            if (dayStr >= seriesStart && (!seriesEnd || dayStr <= seriesEnd)) {
              buckets.get(dayKeys[i])!.push(e);
            }
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
      isPast: i < daysFromMonday,
      startMs: d.getTime(),
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

  const totalEvents = days[daysFromMonday].topPicks.length + days[daysFromMonday].rest.length;

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
          initialActiveIdx={daysFromMonday}
          periods={periods}
          childAgeMonths={cfg.child.ageMonths}
          homeLat={cfg.home.lat}
          homeLng={cfg.home.lng}
        />
      )}
    </main>
  );
}
