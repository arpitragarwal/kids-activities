import { addDays, startOfDay, endOfDay } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { fetchEventsBetween, rank } from "@/lib/rank";
import { getCachedWeather } from "@/lib/weather";
import { getEffectiveConfig } from "@/lib/userPrefs";
import { parseScheduleLabel } from "@/lib/schedule";
import { EventCard } from "@/components/EventCard";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const now = new Date();
  const cfg = await getEffectiveConfig();
  const start = startOfDay(now);
  const end = endOfDay(addDays(now, 7));

  const [{ periods }, dbEvents] = await Promise.all([
    getCachedWeather(),
    fetchEventsBetween(start, end),
  ]);

  const ranked = rank(dbEvents, {
    at: now,
    weather: periods,
    childAgeMonths: cfg.child.ageMonths,
    home: cfg.home,
  });

  // Bucket by day. One-off events (library) go to their date. Class series
  // (cityRec evergreen with a parseable schedule) get distributed across each
  // matching weekday in the window. Parks + unparseable evergreens fall under
  // "Anytime".
  const days: Record<string, typeof ranked> = { Anytime: [] };
  const dayKeys: string[] = [];
  const dayDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const k = formatInTimeZone(d, cfg.timezone, "EEE MMM d");
    days[k] = [];
    dayKeys.push(k);
    dayDates.push(d);
  }

  for (const e of ranked) {
    if (!e.evergreen) {
      const k = formatInTimeZone(new Date(e.start_at), cfg.timezone, "EEE MMM d");
      if (days[k]) days[k].push(e);
      continue;
    }
    if (e.source_id === "cityRec" && e.schedule_label) {
      const sched = parseScheduleLabel(e.schedule_label);
      if (sched.days.length > 0) {
        for (let i = 0; i < dayDates.length; i++) {
          if (sched.days.includes(dayDates[i].getDay())) {
            days[dayKeys[i]].push(e);
          }
        }
        continue;
      }
    }
    days["Anytime"].push(e);
  }

  return (
    <main>
      <h1 className="text-lg font-semibold mb-4">Next 7 days</h1>
      {dayKeys.map((k) => (
        <section key={k} className="mb-6">
          <h2 className="text-sm font-medium text-stone-700 mb-2 sticky top-0 bg-[#fafaf7] py-1">
            {k}
            <span className="text-xs text-stone-400 ml-2">
              ({days[k].length})
            </span>
          </h2>
          {days[k].length === 0 ? (
            <div className="text-xs text-stone-400 pl-1">Nothing scheduled</div>
          ) : (
            <div className="space-y-2">
              {days[k].slice(0, 6).map((e) => (
                <EventCard key={`${e.source_id}-${e.external_id}`} event={e} />
              ))}
            </div>
          )}
        </section>
      ))}
      <section className="mb-6">
        <h2 className="text-sm font-medium text-stone-700 mb-2">
          Anytime
          <span className="text-xs text-stone-400 ml-2">
            ({days["Anytime"].length})
          </span>
        </h2>
        <div className="space-y-2">
          {days["Anytime"].slice(0, 8).map((e) => (
            <EventCard key={`${e.source_id}-${e.external_id}`} event={e} />
          ))}
        </div>
      </section>
    </main>
  );
}
