import { cookies } from "next/headers";
import { config as defaultConfig } from "./config";

export interface EffectiveConfig {
  child: { name: string; ageMonths: number };
  home: { lat: number; lng: number; label: string; isDefault: boolean };
  maxDistanceMiles: number;
  timezone: string;
}

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function getEffectiveConfig(): Promise<EffectiveConfig> {
  const c = await cookies();
  const ageRaw = c.get("ageMonths")?.value;
  const latRaw = c.get("homeLat")?.value;
  const lngRaw = c.get("homeLng")?.value;
  const labelRaw = c.get("homeLabel")?.value;

  const ageMonths =
    ageRaw && Number.isFinite(Number(ageRaw))
      ? Number(ageRaw)
      : defaultConfig.child.ageMonths;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  const hasHome = Number.isFinite(lat) && Number.isFinite(lng);

  return {
    child: { name: defaultConfig.child.name, ageMonths },
    home: hasHome
      ? { lat, lng, label: labelRaw ?? "(saved)", isDefault: false }
      : {
          lat: defaultConfig.home.lat,
          lng: defaultConfig.home.lng,
          label: "Mountain View City Hall (default)",
          isDefault: true,
        },
    maxDistanceMiles: defaultConfig.maxDistanceMiles,
    timezone: defaultConfig.timezone,
  };
}

export const COOKIE_MAX_AGE = ONE_YEAR;
