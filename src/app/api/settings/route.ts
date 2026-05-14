import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_MAX_AGE } from "@/lib/userPrefs";
import { logSettingsChange } from "@/lib/analytics";
import { isInBayArea } from "@/lib/address";

export const dynamic = "force-dynamic";

interface Geo {
  lat: number;
  lng: number;
  label: string;
}

// Known Bay Area cities, sorted longest-first so multi-word names match before
// single-word substrings (e.g. "South San Francisco" before "San Francisco").
const BAY_AREA_CITIES = [
  "South San Francisco", "San Francisco", "San Jose", "San Mateo", "San Carlos",
  "San Bruno", "San Ramon", "San Leandro", "San Rafael", "San Pablo",
  "Mountain View", "Palo Alto", "East Palo Alto", "Los Altos", "Los Gatos",
  "Menlo Park", "Redwood City", "Foster City", "Half Moon Bay", "Daly City",
  "Walnut Creek", "Castro Valley", "Union City", "Morgan Hill",
  "Sunnyvale", "Cupertino", "Santa Clara", "Campbell", "Saratoga", "Milpitas",
  "Fremont", "Newark", "Hayward", "Oakland", "Berkeley", "Alameda", "Emeryville",
  "Albany", "Richmond", "El Cerrito", "Concord", "Pleasanton", "Livermore",
  "Dublin", "Danville", "Lafayette", "Orinda", "Moraga", "Pacifica",
  "Burlingame", "Millbrae", "Belmont", "Brisbane",
].sort((a, b) => b.length - a.length);

function injectCityComma(query: string): string | null {
  if (query.includes(",")) return null;
  const lower = query.toLowerCase();
  for (const city of BAY_AREA_CITIES) {
    const cityLower = city.toLowerCase();
    const idx = lower.indexOf(cityLower);
    if (idx <= 0) continue;
    // Must be preceded by whitespace (not mid-word) and either end the string
    // or be followed by a space (avoid "Sunnyvalefoo").
    const before = query[idx - 1];
    const after = query[idx + city.length];
    if (!/\s/.test(before)) continue;
    if (after !== undefined && after !== " " && after !== ",") continue;
    return `${query.slice(0, idx).trimEnd()}, ${query.slice(idx)}`;
  }
  return null;
}

async function fetchOne(q: string): Promise<Geo | null> {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=` +
    encodeURIComponent(q);
  const res = await fetch(url, {
    headers: { "User-Agent": "mv-kids (https://github.com/arpitragarwal/kids-activities)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const arr = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
    addresstype?: string;
  }>;
  if (arr.length === 0) return null;
  const top = arr[0];
  // Reject only state- or country-level resolutions — those mean Nominatim
  // gave up on the specifics (e.g. junk input collapsing to "California" via
  // the ", CA" suffix we may append). Cities, towns, suburbs, neighborhoods,
  // streets, and buildings are all acceptable — they're addresstype "city",
  // "town", "village", "suburb", "road", "building", etc.
  if (top.addresstype === "state" || top.addresstype === "country") {
    return null;
  }
  return { lat: Number(top.lat), lng: Number(top.lon), label: top.display_name };
}

function buildVariants(query: string): string[] {
  const trimmed = query.trim();
  const hasStateHint =
    /\b(ca|california)\b/i.test(trimmed) || /,\s*[A-Z]{2}\b/.test(trimmed);

  const variants: string[] = [trimmed];

  const withComma = injectCityComma(trimmed);
  if (withComma) variants.push(withComma);

  const base = withComma ?? trimmed;
  if (!hasStateHint) {
    variants.push(`${base}, CA`);
  }

  // Last resort for truly bare streets: explicit regional context.
  if (!hasStateHint && !trimmed.includes(",") && !withComma) {
    variants.push(`${trimmed}, San Francisco Bay Area, CA`);
  }

  return [...new Set(variants)];
}

async function geocode(query: string): Promise<Geo> {
  const variants = buildVariants(query);
  for (const v of variants) {
    const hit = await fetchOne(v);
    if (hit) return hit;
  }
  throw new Error("Address not found");
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const action = String(form.get("action") ?? "save");
  const c = await cookies();
  const redirectUrl = new URL("/", req.url);
  const wantsJson = req.headers.get("accept")?.includes("application/json") ?? false;

  function fail(message: string, httpStatus = 400) {
    if (wantsJson) {
      return NextResponse.json({ error: message }, { status: httpStatus });
    }
    redirectUrl.searchParams.set("error", message);
    return NextResponse.redirect(redirectUrl, 303);
  }

  function ok(payload: Record<string, unknown>, statusParam: string) {
    if (wantsJson) {
      return NextResponse.json({ ok: true, ...payload });
    }
    redirectUrl.searchParams.set("status", statusParam);
    return NextResponse.redirect(redirectUrl, 303);
  }

  // Preview: geocode only, no cookie writes. Always returns JSON.
  if (action === "preview") {
    const address = String(form.get("address") ?? "").trim();
    if (!address) {
      return NextResponse.json({ error: "Enter an address to check" }, { status: 400 });
    }
    try {
      const geo = await geocode(address);
      return NextResponse.json({
        ok: true,
        label: geo.label,
        lat: geo.lat,
        lng: geo.lng,
        outOfArea: !isInBayArea(geo.lat, geo.lng),
      });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Geocoding failed" },
        { status: 400 },
      );
    }
  }

  if (action === "reset") {
    c.delete("ageMonths");
    c.delete("homeLat");
    c.delete("homeLng");
    c.delete("homeLabel");
    void logSettingsChange({
      kind: "reset",
      ageMonths: null,
      resolvedLabel: null,
      lat: null,
      lng: null,
    }).catch((err) => console.error("logSettingsChange failed", err));
    return ok({}, "reset");
  }

  // Age — preferred form is ageYears + ageExtraMonths; ageMonths kept as a
  // legacy fallback so prior bookmarks / autofill still work.
  const yearsRaw = form.get("ageYears");
  const extraRaw = form.get("ageExtraMonths");
  const legacyRaw = form.get("ageMonths");
  let ageMonths: number | null = null;
  if (yearsRaw !== null || extraRaw !== null) {
    const y = Number(yearsRaw ?? 0);
    const m = Number(extraRaw ?? 0);
    if (!Number.isFinite(y) || y < 0 || y > 20 || !Number.isFinite(m) || m < 0 || m > 11) {
      return fail("Years 0-20, extra months 0-11");
    }
    ageMonths = Math.round(y) * 12 + Math.round(m);
  } else if (legacyRaw !== null && String(legacyRaw).trim() !== "") {
    const n = Number(legacyRaw);
    if (!Number.isFinite(n) || n < 0 || n > 240) {
      return fail("Age must be 0-240 months");
    }
    ageMonths = Math.round(n);
  }
  if (ageMonths !== null) {
    c.set("ageMonths", String(ageMonths), {
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      path: "/",
    });
  }

  // Address — geocode if provided
  const address = String(form.get("address") ?? "").trim();
  let savedLabel: string | undefined;
  let savedLat: number | null = null;
  let savedLng: number | null = null;
  if (address) {
    try {
      const geo = await geocode(address);
      c.set("homeLat", String(geo.lat), {
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
        path: "/",
      });
      c.set("homeLng", String(geo.lng), {
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
        path: "/",
      });
      c.set("homeLabel", geo.label, {
        maxAge: COOKIE_MAX_AGE,
        sameSite: "lax",
        path: "/",
      });
      savedLabel = geo.label;
      savedLat = geo.lat;
      savedLng = geo.lng;
    } catch (e) {
      return fail(e instanceof Error ? e.message : "Geocoding failed");
    }
  }

  // Only log if anything actually changed.
  if (ageMonths !== null || savedLabel) {
    void logSettingsChange({
      kind: "save",
      ageMonths,
      resolvedLabel: savedLabel ?? null,
      lat: savedLat,
      lng: savedLng,
    }).catch((err) => console.error("logSettingsChange failed", err));
  }

  const saveResult: Record<string, unknown> = {};
  if (savedLabel) saveResult.label = savedLabel;
  if (savedLat !== null && savedLng !== null) {
    saveResult.outOfArea = !isInBayArea(savedLat, savedLng);
  }
  return ok(saveResult, "saved");
}
