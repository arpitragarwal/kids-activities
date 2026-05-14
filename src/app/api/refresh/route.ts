import { NextRequest, NextResponse } from "next/server";
import { runAllSources, SOURCES } from "@/lib/sources";
import { refreshAllCachedBuckets } from "@/lib/weather";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // No secret configured — allow (dev mode).
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  // Allow manual browser POST from the /sources page if same-origin.
  if (req.method === "POST") {
    const ref = req.headers.get("referer") ?? "";
    const host = req.headers.get("host") ?? "";
    if (ref.includes(host)) return true;
  }
  return false;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const started = Date.now();
  // Weather + sources in parallel.
  const [weatherResult, sourceResults] = await Promise.allSettled([
    refreshAllCachedBuckets(),
    runAllSources(),
  ]);

  const weather =
    weatherResult.status === "fulfilled"
      ? {
          ok: weatherResult.value.every((b) => b.ok),
          buckets: weatherResult.value,
        }
      : { ok: false, error: String(weatherResult.reason) };

  const sources =
    sourceResults.status === "fulfilled"
      ? sourceResults.value
      : SOURCES.map((s) => ({
          sourceId: s.id,
          ok: false,
          eventCount: 0,
          error: String(sourceResults.reason),
          durationMs: 0,
        }));

  // Browser-friendly: if same-origin POST, redirect back to /sources.
  const ref = req.headers.get("referer");
  if (req.method === "POST" && ref) {
    return NextResponse.redirect(ref, 303);
  }

  return NextResponse.json({
    durationMs: Date.now() - started,
    weather,
    sources,
  });
}

export const GET = handle;
export const POST = handle;
