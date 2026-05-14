import { sql, ensureSchema } from "./db";
import { config } from "./config";

export interface HourlyForecast {
  startTime: string; // ISO
  endTime: string;
  temperature: number; // °F
  probabilityOfPrecipitation: number; // 0-100
  shortForecast: string;
  windSpeed: string;
  isDaytime: boolean;
}

const UA = "mv-kids (github.com/yourname/mv-kids)";

// Bucket coords to ~7mi precision (1 decimal place) so distinct addresses in
// the same metro share a forecast cache row, keeping NWS call volume bounded.
function bucketCoords(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 10) / 10,
    lng: Math.round(lng * 10) / 10,
  };
}

async function fetchNwsHourly(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<HourlyForecast[]> {
  // Step 1: resolve gridpoint
  const points = await fetch(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
    { headers: { "User-Agent": UA, Accept: "application/geo+json" }, signal },
  );
  if (!points.ok) throw new Error(`NWS points ${points.status}`);
  const pointsData = (await points.json()) as {
    properties: { forecastHourly: string };
  };
  const hourlyUrl = pointsData.properties.forecastHourly;

  const hourly = await fetch(hourlyUrl, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
    signal,
  });
  if (!hourly.ok) throw new Error(`NWS hourly ${hourly.status}`);
  const hourlyData = (await hourly.json()) as {
    properties: {
      periods: Array<{
        startTime: string;
        endTime: string;
        temperature: number;
        probabilityOfPrecipitation: { value: number | null };
        shortForecast: string;
        windSpeed: string;
        isDaytime: boolean;
      }>;
    };
  };
  return hourlyData.properties.periods.map((p) => ({
    startTime: p.startTime,
    endTime: p.endTime,
    temperature: p.temperature,
    probabilityOfPrecipitation: p.probabilityOfPrecipitation?.value ?? 0,
    shortForecast: p.shortForecast,
    windSpeed: p.windSpeed,
    isDaytime: p.isDaytime,
  }));
}

async function writeCache(lat: number, lng: number, periods: HourlyForecast[]): Promise<void> {
  await sql`
    INSERT INTO weather_cache (lat, lng, fetched_at, hourly_json)
    VALUES (${lat}, ${lng}, NOW(), ${JSON.stringify(periods)}::jsonb)
    ON CONFLICT (lat, lng) DO UPDATE
      SET fetched_at = EXCLUDED.fetched_at, hourly_json = EXCLUDED.hourly_json
  `;
}

export async function refreshWeatherFor(lat: number, lng: number): Promise<HourlyForecast[]> {
  await ensureSchema();
  const b = bucketCoords(lat, lng);
  const periods = await fetchNwsHourly(b.lat, b.lng);
  await writeCache(b.lat, b.lng, periods);
  return periods;
}

export interface BucketRefreshResult {
  lat: number;
  lng: number;
  ok: boolean;
  periods?: number;
  error?: string;
}

// Cron entry point: refresh every bucket that has ever been cached, plus the
// default location (so weather is always available for first-time visitors).
export async function refreshAllCachedBuckets(): Promise<BucketRefreshResult[]> {
  await ensureSchema();
  const { rows } = (await sql`SELECT lat, lng FROM weather_cache`) as unknown as {
    rows: { lat: number; lng: number }[];
  };
  const buckets = new Map<string, { lat: number; lng: number }>();
  for (const r of rows) {
    buckets.set(`${r.lat},${r.lng}`, { lat: r.lat, lng: r.lng });
  }
  const def = bucketCoords(config.home.lat, config.home.lng);
  buckets.set(`${def.lat},${def.lng}`, def);

  const results: BucketRefreshResult[] = [];
  for (const b of buckets.values()) {
    try {
      const periods = await refreshWeatherFor(b.lat, b.lng);
      results.push({ lat: b.lat, lng: b.lng, ok: true, periods: periods.length });
    } catch (e) {
      results.push({
        lat: b.lat,
        lng: b.lng,
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return results;
}

export async function getWeather(
  lat: number,
  lng: number,
): Promise<{ fetchedAt: Date | null; periods: HourlyForecast[] }> {
  await ensureSchema();
  const b = bucketCoords(lat, lng);
  const { rows } = (await sql`
    SELECT fetched_at, hourly_json
    FROM weather_cache
    WHERE lat = ${b.lat} AND lng = ${b.lng}
    LIMIT 1
  `) as unknown as { rows: { fetched_at: string; hourly_json: HourlyForecast[] }[] };
  if (rows.length > 0) {
    return {
      fetchedAt: new Date(rows[0].fetched_at),
      periods: rows[0].hourly_json,
    };
  }

  // Cache miss — try a quick inline fetch. NWS is US-only, so addresses
  // outside the US will 404 and we fall through to the empty fallback that
  // ContextHeader already renders as "Weather not yet fetched".
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 2500);
  try {
    const periods = await fetchNwsHourly(b.lat, b.lng, ac.signal);
    await writeCache(b.lat, b.lng, periods);
    return { fetchedAt: new Date(), periods };
  } catch (e) {
    console.warn(`weather inline fetch failed for ${b.lat},${b.lng}:`, e);
    return { fetchedAt: null, periods: [] };
  } finally {
    clearTimeout(timer);
  }
}

export interface WeatherSummary {
  tempF: number;
  precipPct: number;
  shortForecast: string;
  isDaytime: boolean;
  // Derived: is this a "good outdoor" hour?
  outdoorScore: number; // 0..1, higher = better
}

export function summarizeForHour(
  periods: HourlyForecast[],
  hour: Date,
): WeatherSummary | null {
  const target = hour.getTime();
  const p = periods.find(
    (x) => new Date(x.startTime).getTime() <= target && new Date(x.endTime).getTime() > target,
  );
  if (!p) return null;
  return {
    tempF: p.temperature,
    precipPct: p.probabilityOfPrecipitation,
    shortForecast: p.shortForecast,
    isDaytime: p.isDaytime,
    outdoorScore: outdoorScore(p),
  };
}

function outdoorScore(p: HourlyForecast): number {
  let s = 1;
  // Temperature: ideal 60-78°F for kids; degrade outside that band.
  if (p.temperature < 50 || p.temperature > 88) s -= 0.6;
  else if (p.temperature < 58 || p.temperature > 82) s -= 0.25;
  // Precipitation
  if (p.probabilityOfPrecipitation >= 50) s -= 0.7;
  else if (p.probabilityOfPrecipitation >= 25) s -= 0.3;
  // Daytime preference for outdoor activities
  if (!p.isDaytime) s -= 0.4;
  return Math.max(0, Math.min(1, s));
}
