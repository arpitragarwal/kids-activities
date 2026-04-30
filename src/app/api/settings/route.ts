import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_MAX_AGE } from "@/lib/userPrefs";

export const dynamic = "force-dynamic";

interface Geo {
  lat: number;
  lng: number;
  label: string;
}

async function geocode(query: string): Promise<Geo> {
  // Bias toward Mountain View / SF Bay Area by appending the region if the
  // user typed only a street address.
  const biased = /mountain view|ca|california/i.test(query) ? query : `${query}, Mountain View, CA`;
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=` +
    encodeURIComponent(biased);
  const res = await fetch(url, {
    headers: { "User-Agent": "mv-kids (https://github.com/arpitragarwal/kids-activities)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Geocoder HTTP ${res.status}`);
  const arr = (await res.json()) as Array<{
    lat: string;
    lon: string;
    display_name: string;
  }>;
  if (arr.length === 0) throw new Error("Address not found");
  return {
    lat: Number(arr[0].lat),
    lng: Number(arr[0].lon),
    label: arr[0].display_name,
  };
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const action = String(form.get("action") ?? "save");
  const c = await cookies();
  const redirectUrl = new URL("/", req.url);

  if (action === "reset") {
    c.delete("ageMonths");
    c.delete("homeLat");
    c.delete("homeLng");
    c.delete("homeLabel");
    redirectUrl.searchParams.set("status", "reset");
    return NextResponse.redirect(redirectUrl, 303);
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
      redirectUrl.searchParams.set("error", "Years 0-20, extra months 0-11");
      return NextResponse.redirect(redirectUrl, 303);
    }
    ageMonths = Math.round(y) * 12 + Math.round(m);
  } else if (legacyRaw !== null && String(legacyRaw).trim() !== "") {
    const n = Number(legacyRaw);
    if (!Number.isFinite(n) || n < 0 || n > 240) {
      redirectUrl.searchParams.set("error", "Age must be 0-240 months");
      return NextResponse.redirect(redirectUrl, 303);
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
    } catch (e) {
      redirectUrl.searchParams.set(
        "error",
        e instanceof Error ? e.message : "Geocoding failed",
      );
      return NextResponse.redirect(redirectUrl, 303);
    }
  }

  redirectUrl.searchParams.set("status", "saved");
  return NextResponse.redirect(redirectUrl, 303);
}
