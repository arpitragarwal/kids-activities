import { addHours, endOfDay, startOfDay } from "date-fns";
import { fetchEventsBetween, rank } from "@/lib/rank";
import { getCachedWeather } from "@/lib/weather";
import { getSourceHealth } from "@/lib/sources";
import { getEffectiveConfig } from "@/lib/userPrefs";
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
  const top = ranked.slice(0, 12);

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

      <h2 className="text-xs uppercase tracking-wide text-stone-500 mb-2">
        Top picks right now
      </h2>
      {top.length === 0 ? (
        <div className="border border-stone-200 rounded-lg p-6 text-center text-stone-500 bg-white">
          <p>No events yet — has the cron run?</p>
          <p className="mt-2 text-xs">
            Hit{" "}
            <code className="bg-stone-100 px-1 py-0.5 rounded">/api/refresh</code>{" "}
            to populate.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {top.map((e) => (
            <EventCard key={`${e.source_id}-${e.external_id}`} event={e} />
          ))}
        </div>
      )}
    </main>
  );
}
