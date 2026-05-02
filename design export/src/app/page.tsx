import { addHours, endOfDay, startOfDay } from "date-fns";
import { fetchEventsBetween, rank } from "@/lib/rank";
import { getCachedWeather } from "@/lib/weather";
import { getSourceHealth } from "@/lib/sources";
import { getEffectiveConfig } from "@/lib/userPrefs";
import { meetsOn } from "@/lib/schedule";
import { EventCard } from "@/components/EventCard";
import { ContextHeader } from "@/components/ContextHeader";
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

  // Today view — drop recurring classes that don't meet today.
  const todayDow = now.getDay();
  const todayPicks = ranked.filter(
    (e) =>
      !(e.source_id === "cityRec" && e.evergreen) ||
      meetsOn(e.schedule_label, todayDow),
  );

  // Top picks: up to 3 events, one per (source × indoorness) bucket first.
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
  const rest = todayPicks.filter(
    (e) => !topPickIds.has(`${e.source_id}:${e.external_id}`),
  );

  const broken = health.filter(
    (h) => h.status === "broken" || h.status === "stale",
  );

  return (
    <main>
      {/* ── Unified context header (date + weather + profile) ── */}
      <ContextHeader
        periods={periods}
        fetchedAt={fetchedAt}
        cfg={cfg}
        status={params.status}
        error={params.error}
      />

      {/* ── Source health alert ── */}
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

      {/* ── Empty state ── */}
      {todayPicks.length === 0 ? (
        <div className="border border-dashed border-stone-300 rounded-xl p-8 text-center text-stone-500 bg-white">
          <p className="font-medium">No events yet — has the cron run?</p>
          <p className="mt-2 text-xs text-stone-400">
            Hit{" "}
            <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-600">
              /api/refresh
            </code>{" "}
            to populate.
          </p>
        </div>
      ) : (
        <>
          {/* ── Top picks ── */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
                <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1l1.8 3.6L14 5.4l-3 2.9.7 4.1L8 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z" />
                </svg>
                Top picks
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {topPicks.map((e) => (
                <EventCard
                  key={`${e.source_id}-${e.external_id}`}
                  event={e}
                  childAgeMonths={cfg.child.ageMonths}
                />
              ))}
            </div>
          </section>

          {/* ── Everything else ── */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                Everything available today
              </h2>
              <span className="text-[11px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                {rest.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {rest.map((e) => (
                <EventCard
                  key={`${e.source_id}-${e.external_id}`}
                  event={e}
                  childAgeMonths={cfg.child.ageMonths}
                />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
