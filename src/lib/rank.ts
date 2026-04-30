import { sql, ensureSchema } from "./db";
import { config } from "./config";
import { distanceMiles } from "./distance";
import { summarizeForHour, type HourlyForecast, type WeatherSummary } from "./weather";
import type { Indoorness, Registration } from "./types";

export interface DbEventRow {
  source_id: string;
  external_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  age_min_months: number | null;
  age_max_months: number | null;
  indoorness: Indoorness;
  cost: string;
  registration: Registration;
  url: string | null;
  evergreen: boolean;
}

export interface RankedEvent extends DbEventRow {
  score: number;
  reasons: string[]; // human-readable, why we ranked this here
  distanceMiles: number | null;
  weather: WeatherSummary | null;
}

export async function fetchEventsBetween(start: Date, end: Date): Promise<DbEventRow[]> {
  await ensureSchema();
  const { rows } = (await sql`
    SELECT source_id, external_id, title, description, start_at, end_at,
           location, lat, lng, age_min_months, age_max_months,
           indoorness, cost, registration, url, evergreen
    FROM events
    WHERE evergreen = TRUE
       OR (start_at >= ${start.toISOString()} AND start_at <= ${end.toISOString()})
    ORDER BY start_at ASC
  `) as unknown as { rows: DbEventRow[] };
  return rows;
}

interface RankInput {
  /** When the user is asking for a recommendation. */
  at: Date;
  weather: HourlyForecast[];
  childAgeMonths: number;
  home: { lat: number; lng: number };
}

export function rank(events: DbEventRow[], input: RankInput): RankedEvent[] {
  const ranked: RankedEvent[] = [];
  for (const e of events) {
    // For non-evergreen events that have already ended, skip.
    const start = new Date(e.start_at);
    const end = e.end_at ? new Date(e.end_at) : null;
    if (!e.evergreen && end && end.getTime() < input.at.getTime()) continue;

    let score = 1.0;
    const reasons: string[] = [];

    // --- Age fit ---
    const min = e.age_min_months;
    const max = e.age_max_months;
    if (min !== null && max !== null) {
      if (input.childAgeMonths >= min && input.childAgeMonths <= max) {
        score += 0.4;
        reasons.push(`age fits (${min}-${max}mo)`);
      } else {
        // How far out of range?
        const off =
          input.childAgeMonths < min
            ? min - input.childAgeMonths
            : input.childAgeMonths - max;
        if (off <= 6) score += 0.05;
        else score -= 0.5;
        reasons.push(`age range ${min}-${max}mo (off by ${off}mo)`);
      }
    } else {
      score += 0.05;
      reasons.push("age unknown");
    }

    // --- Distance ---
    let dist: number | null = null;
    if (e.lat !== null && e.lng !== null) {
      dist = distanceMiles(input.home, { lat: e.lat, lng: e.lng });
      if (dist <= 1) {
        score += 0.4;
        reasons.push(`${dist.toFixed(1)}mi — very close`);
      } else if (dist <= 3) {
        score += 0.2;
        reasons.push(`${dist.toFixed(1)}mi away`);
      } else if (dist <= config.maxDistanceMiles) {
        score += 0.0;
        reasons.push(`${dist.toFixed(1)}mi away`);
      } else {
        score -= 0.6;
        reasons.push(`${dist.toFixed(1)}mi — quite far`);
      }
    }

    // --- Weather alignment ---
    // For scheduled events, check the hour of the event. For evergreen
    // entries, check the asking hour.
    const weatherHour = e.evergreen ? input.at : start;
    const wx = summarizeForHour(input.weather, weatherHour);
    if (wx) {
      if (e.indoorness === "outdoor") {
        if (wx.outdoorScore >= 0.7) {
          score += 0.5;
          reasons.push(`great outdoor weather (${wx.tempF}°F)`);
        } else if (wx.outdoorScore >= 0.4) {
          score += 0.1;
          reasons.push(`weather ok (${wx.tempF}°F, ${wx.precipPct}% rain)`);
        } else {
          score -= 0.6;
          reasons.push(`bad outdoor weather (${wx.tempF}°F, ${wx.precipPct}% rain)`);
        }
      } else if (e.indoorness === "indoor") {
        if (wx.outdoorScore < 0.4) {
          score += 0.4;
          reasons.push("indoor pick for poor weather");
        } else {
          score += 0.05;
          reasons.push("indoor option");
        }
      }
    }

    // --- Time of day for scheduled events ---
    if (!e.evergreen) {
      const hoursAway = (start.getTime() - input.at.getTime()) / (1000 * 60 * 60);
      if (hoursAway < 0 && end && end.getTime() > input.at.getTime()) {
        score += 0.5;
        reasons.push("happening right now");
      } else if (hoursAway >= 0 && hoursAway <= 3) {
        score += 0.4;
        reasons.push("starts soon");
      } else if (hoursAway > 3 && hoursAway <= 24) {
        score += 0.15;
      } else if (hoursAway > 24) {
        score -= 0.05 * Math.min(hoursAway / 24, 7);
      }

      const startHour = start.getHours();
      // Toddler nap penalty (12-2pm)
      if (input.childAgeMonths < 36 && startHour >= 12 && startHour < 14) {
        score -= 0.2;
        reasons.push("during typical nap window");
      }
    }

    ranked.push({
      ...e,
      score,
      reasons,
      distanceMiles: dist,
      weather: wx,
    });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}
