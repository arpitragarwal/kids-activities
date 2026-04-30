import { formatDistanceToNow } from "date-fns";
import { getSourceHealth } from "@/lib/sources";
import { getCachedWeather } from "@/lib/weather";

export const dynamic = "force-dynamic";

const STATUS_COLOR: Record<string, string> = {
  ok: "text-emerald-700 bg-emerald-50 border-emerald-200",
  stale: "text-amber-700 bg-amber-50 border-amber-200",
  broken: "text-red-700 bg-red-50 border-red-200",
  never_run: "text-stone-600 bg-stone-50 border-stone-200",
};

export default async function HealthPage() {
  const [health, { fetchedAt }] = await Promise.all([
    getSourceHealth(),
    getCachedWeather(),
  ]);

  return (
    <main>
      <h1 className="text-lg font-semibold mb-1">Source health</h1>
      <p className="text-sm text-stone-500 mb-6">
        Cron runs hourly. If a source is broken, the last error is shown below
        — fix the scraper, then trigger a manual refresh.
      </p>

      <div className="space-y-3">
        {health.map((h) => (
          <div
            key={h.id}
            className={`border rounded-lg p-4 ${STATUS_COLOR[h.status]}`}
          >
            <div className="flex items-baseline justify-between">
              <div className="font-medium">{h.name}</div>
              <div className="text-xs uppercase tracking-wide">{h.status}</div>
            </div>
            <div className="text-xs mt-1 opacity-80">
              {h.lastSuccessAt
                ? `Last success ${formatDistanceToNow(h.lastSuccessAt)} ago`
                : "Never succeeded"}
              {h.lastEventCount !== null && ` · ${h.lastEventCount} events`}
            </div>
            {h.lastError && (
              <pre className="mt-2 text-xs whitespace-pre-wrap font-mono opacity-90 bg-white/60 rounded p-2">
                {h.lastError}
              </pre>
            )}
            <form action={`/api/refresh-one?id=${h.id}`} method="post" className="mt-3">
              <button
                type="submit"
                className="text-xs px-2 py-1 rounded border border-current hover:bg-white/40"
              >
                Refresh this source
              </button>
            </form>
          </div>
        ))}
      </div>

      <div className="mt-8 border border-stone-200 rounded-lg p-4 bg-white">
        <div className="font-medium">Weather cache</div>
        <div className="text-xs text-stone-500 mt-1">
          {fetchedAt
            ? `Last fetched ${formatDistanceToNow(fetchedAt)} ago`
            : "Never fetched"}
        </div>
      </div>

      <form action="/api/refresh" method="post" className="mt-6">
        <button
          type="submit"
          className="px-3 py-1.5 rounded bg-black text-white text-sm hover:bg-stone-800"
        >
          Refresh everything now
        </button>
      </form>
    </main>
  );
}
