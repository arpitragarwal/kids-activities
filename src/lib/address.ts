const US_STATE_RE = /^(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)$/i;

const STREETY_RE = /\b(Avenue|Ave|Street|St|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Highway|Hwy|Terrace|Ter|Circle|Cir)\.?$/i;

export function pickCity(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  for (let i = 1; i < parts.length; i++) {
    if (/county$/i.test(parts[i]) || US_STATE_RE.test(parts[i])) {
      return parts[i - 1];
    }
  }
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d+$/.test(p)) continue;
    if (STREETY_RE.test(p)) continue;
    return p;
  }
  return parts[parts.length - 1];
}

export function cityFromLabel(label: string): string {
  const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
  return pickCity(parts);
}

// ~100m precision at the equator (3 decimal places ≈ 111m).
export function coarseLatLng(lat: number, lng: number): { lat: number; lng: number } {
  return {
    lat: Math.round(lat * 1000) / 1000,
    lng: Math.round(lng * 1000) / 1000,
  };
}

// Generous bounding box covering the 9-county SF Bay Area: Sonoma/Napa in the
// north down to southern Santa Clara, ocean west, eastern Contra Costa east.
const BAY_AREA_BBOX = {
  minLat: 36.85,
  maxLat: 38.55,
  minLng: -123.10,
  maxLng: -121.20,
};

export function isInBayArea(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= BAY_AREA_BBOX.minLat &&
    lat <= BAY_AREA_BBOX.maxLat &&
    lng >= BAY_AREA_BBOX.minLng &&
    lng <= BAY_AREA_BBOX.maxLng
  );
}
