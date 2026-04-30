import { addHours, endOfDay, startOfDay } from "date-fns";
import { fetchEventsBetween, rank } from "@/lib/rank";
import { getCachedWeather } from "@/lib/weather";
import { getSourceHealth } from "@/lib/sources";
import { getEffectiveConfig } from "@/lib/userPrefs";
import { meetsOn } from "@/lib/schedule";
import { EventCard } from "@/components/EventCard";
import { WeatherBanner } from "@/components/WeatherBanner";
import { SettingsBar } from "@/components/SettingsBar";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const now = new Date();
  const cfg = await getEffectiveConfig();
  const params = await searchParams;
  const [{ periods, fetchedAt }, dbEvents, health] = await Promise.all([
    getCachedWeather(),
    fetchEventsBetween(startOfDay(now), endOfDay(addHours(now, 24))),
    getSourceHealth(),
  ]);

  const ranked = rank(dbEvents, {
    at: now,
    weather: periods,
    childAgeMonths: cfg.child.ageMonths,
    home: cfg.home,
  });
  // Today view only — drop class series whose meeting days don't include today.
  // (Calendar view keeps them, distributed across their meeting days.)
  const todayDow = now.getDay();
  const todayPicks = ranked.filter(
    (e) => !(e.source_id === "cityRec" && e.evergreen) || meetsOn(e.schedule_label, todayDow),
  );

  // Top picks: 3 events with diversity. First pass takes the highest-scoring
  // event from each (source, indoorness) bucket; if we still need slots, fill
  // from the next-highest remaining.
  const topPicks: typeof todayPicks = [];
  const usedBuckets = new Set<string>();
  for (const e of todayPicks) {
    if (topPicks.length >= 3) break;
    const bucket = `${e.source_id}:${e.indoorness}`;
    if (usedBuckets.has(bucket)) continue;
    topPicks.push(e);
    usedBuckets.add(bucket);
  }
  if (topPicks.length < 3) {
    const pickedIds = new Set(topPicks.map((e) => `${e.source_id}:${e.external_id}`));
    for (const e of todayPicks) {
      if (topPicks.length >= 3) break;
      if (pickedIds.has(`${e.source_id}:${e.external_id}`)) continue;
      topPicks.push(e);
    }
  }
  const topPickIds = new Set(topPicks.map((e) => `${e.source_id}:${e.external_id}`));
  const rest = todayPicks.filter((e) => !topPickIds.has(`${e.source_id}:${e.external_id}`));

  const broken = health.filter((h) => h.status === "broken" || h.status === "stale");

  return (
    <main>
      <SettingsBar cfg={cfg} status={params.status} error={params.error} />

      <WeatherBanner periods={periods} fetchedAt={fetchedAt} />

      {broken.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded-lg p-3 mb-4 text-sm text-amber-900">
          <div className="font-medium">
            {broken.length} source{broken.length === 1 ? "" : "s"} need attention
          </div>
          <Link href="/health" className="underline">
            View source health →
          </Link>
        </div>
      )}

      {todayPicks.length === 0 ? (
        <div className="border border-stone-200 rounded-lg p-6 text-center text-stone-500 bg-white">
          <p>No events yet — has the cron run?</p>
          <p className="mt-2 text-xs">
            Hit{" "}
            <code className="bg-stone-100 px-1 py-0.5 rounded">/api/refresh</code>{" "}
            to populate.
          </p>
        </div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-2">
              Top picks
            </h2>
            <div className="space-y-3">
              {topPicks.map((e) => (
                <EventCard key={`${e.source_id}-${e.external_id}`} event={e} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-2">
              Everything available right now{" "}
              <span className="text-stone-400 normal-case">({rest.length})</span>
            </h2>
            <div className="space-y-3">
              {rest.map((e) => (
                <EventCard key={`${e.source_id}-${e.external_id}`} event={e} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
