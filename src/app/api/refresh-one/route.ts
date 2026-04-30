import { NextRequest, NextResponse } from "next/server";
import { SOURCES, runSource } from "@/lib/sources";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  const source = SOURCES.find((s) => s.id === id);
  if (!source) return NextResponse.json({ error: "unknown source" }, { status: 404 });

  const result = await runSource(source);

  const ref = req.headers.get("referer");
  if (req.method === "POST" && ref) {
    return NextResponse.redirect(ref, 303);
  }
  return NextResponse.json(result);
}

export const GET = handle;
export const POST = handle;
