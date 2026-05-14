import { headers, cookies } from "next/headers";
import { createHash } from "node:crypto";
import { sql, ensureSchema } from "./db";
import { cityFromLabel, coarseLatLng } from "./address";

const UA_SALT = process.env.ANALYTICS_SALT ?? "mv-kids-static-salt";

function hashUA(ua: string | null | undefined): string | null {
  if (!ua) return null;
  return createHash("sha256").update(UA_SALT + ua).digest("hex").slice(0, 16);
}

async function getContext(): Promise<{ sid: string | null; ua: string | null; country: string | null }> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  return {
    sid: c.get("sid")?.value ?? null,
    ua: h.get("user-agent"),
    country: h.get("x-vercel-ip-country"),
  };
}

async function ensureSession(sid: string, ua: string | null, country: string | null): Promise<void> {
  await sql`
    INSERT INTO analytics_sessions (id, first_seen, ua_hash, country)
    VALUES (${sid}, NOW(), ${hashUA(ua)}, ${country})
    ON CONFLICT (id) DO NOTHING
  `;
}

export interface PageViewInput {
  path: string;
  ageMonths: number;
  homeLat: number;
  homeLng: number;
  homeLabel: string;
  homeIsDefault: boolean;
}

export async function logPageView(input: PageViewInput): Promise<void> {
  await ensureSchema();
  const { sid, ua, country } = await getContext();
  if (!sid) return;
  await ensureSession(sid, ua, country);

  const { lat, lng } = coarseLatLng(input.homeLat, input.homeLng);
  const city = input.homeIsDefault ? null : cityFromLabel(input.homeLabel);

  await sql`
    INSERT INTO analytics_page_views (session_id, path, age_months, city, lat_approx, lng_approx)
    VALUES (${sid}, ${input.path}, ${input.ageMonths}, ${city}, ${lat}, ${lng})
  `;
}

export interface SettingsChangeInput {
  kind: "save" | "reset";
  ageMonths: number | null;
  resolvedLabel: string | null;
  lat: number | null;
  lng: number | null;
}

export async function logSettingsChange(input: SettingsChangeInput): Promise<void> {
  await ensureSchema();
  const { sid, ua, country } = await getContext();
  if (!sid) return;
  await ensureSession(sid, ua, country);

  const coarsened =
    input.lat !== null && input.lng !== null && Number.isFinite(input.lat) && Number.isFinite(input.lng)
      ? coarseLatLng(input.lat, input.lng)
      : null;
  const city = input.resolvedLabel ? cityFromLabel(input.resolvedLabel) : null;

  await sql`
    INSERT INTO analytics_settings_changes (session_id, kind, age_months, city, lat_approx, lng_approx)
    VALUES (
      ${sid}, ${input.kind}, ${input.ageMonths},
      ${city}, ${coarsened?.lat ?? null}, ${coarsened?.lng ?? null}
    )
  `;
}
