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

async function fetchNwsHourly(lat: number, lng: number): Promise<HourlyForecast[]> {
  // Step 1: resolve gridpoint
  const points = await fetch(
    `https://api.weather.gov/points/${lat.toFixed(4)},${lng.toFixed(4)}`,
    { headers: { "User-Agent": UA, Accept: "application/geo+json" } },
  );
  if (!points.ok) throw new Error(`NWS points ${points.status}`);
  const pointsData = (await points.json()) as {
    properties: { forecastHourly: string };
  };
  const hourlyUrl = pointsData.properties.forecastHourly;

  const hourly = await fetch(hourlyUrl, {
    headers: { "User-Agent": UA, Accept: "application/geo+json" },
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

export async function refreshWeather(): Promise<HourlyForecast[]> {
  await ensureSchema();
  const periods = await fetchNwsHourly(config.home.lat, config.home.lng);
  await sql`
    INSERT INTO weather_cache (lat, lng, fetched_at, hourly_json)
    VALUES (${config.home.lat}, ${config.home.lng}, NOW(), ${JSON.stringify(periods)}::jsonb)
    ON CONFLICT (lat, lng) DO UPDATE
      SET fetched_at = EXCLUDED.fetched_at, hourly_json = EXCLUDED.hourly_json
  `;
  return periods;
}

export async function getCachedWeather(): Promise<{
  fetchedAt: Date | null;
  periods: HourlyForecast[];
}> {
  await ensureSchema();
  const { rows } = (await sql`
    SELECT fetched_at, hourly_json
    FROM weather_cache
    WHERE lat = ${config.home.lat} AND lng = ${config.home.lng}
    LIMIT 1
  `) as unknown as { rows: { fetched_at: string; hourly_json: HourlyForecast[] }[] };
  if (rows.length === 0) return { fetchedAt: null, periods: [] };
  return {
    fetchedAt: new Date(rows[0].fetched_at),
    periods: rows[0].hourly_json,
  };
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
