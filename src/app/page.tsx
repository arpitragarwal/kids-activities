import { addHours, endOfDay, startOfDay } from "date-fns";
import { config } from "@/lib/config";
import { fetchEventsBetween, rank } from "@/lib/rank";
import { getCachedWeather } from "@/lib/weather";
import { getSourceHealth } from "@/lib/sources";
import { EventCard } from "@/components/EventCard";
import { WeatherBanner } from "@/components/WeatherBanner";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HomePage() {
  const now = new Date();
  const [{ periods, fetchedAt }, dbEvents, health] = await Promise.all([
    getCachedWeather(),
    fetchEventsBetween(startOfDay(now), endOfDay(addHours(now, 24))),
    getSourceHealth(),
  ]);

  const ranked = rank(dbEvents, {
    at: now,
    weather: periods,
    childAgeMonths: config.child.ageMonths,
    home: config.home,
  });
  const top = ranked.slice(0, 12);

  const broken = health.filter((h) => h.status === "broken" || h.status === "stale");

  const yearsOld = (config.child.ageMonths / 12).toFixed(1);

  return (
    <main>
      <div className="mb-2 text-sm text-stone-500">
        Picks for {config.child.name} ({yearsOld}y) · within{" "}
        {config.maxDistanceMiles}mi of home
      </div>

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
