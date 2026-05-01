import { formatInTimeZone } from "date-fns-tz";
import type { HourlyForecast } from "@/lib/weather";
import { summarizeForHour } from "@/lib/weather";
import { config } from "@/lib/config";

export function WeatherBanner({
  periods,
  fetchedAt,
}: {
  periods: HourlyForecast[];
  fetchedAt: Date | null;
}) {
  const now = new Date();
  const wx = summarizeForHour(periods, now);
  if (!wx) {
    return (
      <div className="text-sm text-stone-500 mb-4">
        Weather not yet fetched.{" "}
        <a href="/api/refresh" className="underline">
          Refresh now
        </a>
        .
      </div>
    );
  }
  const tone =
    wx.outdoorScore >= 0.7
      ? "bg-emerald-50 border-emerald-200 text-emerald-900"
      : wx.outdoorScore >= 0.4
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-stone-100 border-stone-200 text-stone-800";
  const advice =
    wx.outdoorScore >= 0.7
      ? "Great outdoor weather — favoring parks."
      : wx.outdoorScore >= 0.4
      ? "Mixed weather — outdoor with caution, indoor backups ranked."
      : "Poor for outside — indoor picks ranked higher.";
  const currentTime = formatInTimeZone(now, config.timezone, "h:mm a");
  return (
    <div className={`border rounded-lg p-3 mb-4 ${tone}`}>
      <div className="text-sm font-medium">
        {currentTime} · {Math.round(wx.tempF)}°F · {wx.shortForecast} · {wx.precipPct}% precip
      </div>
      <div className="text-xs mt-0.5 opacity-80">{advice}</div>
      {fetchedAt && (
        <div className="text-[10px] mt-1 opacity-60">
          Updated {formatInTimeZone(fetchedAt, config.timezone, "MMM d h:mm a")}
        </div>
      )}
    </div>
  );
}
