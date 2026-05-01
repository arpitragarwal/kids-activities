import { sql, ensureSchema } from "../db";
import type { NormalizedEvent, SourceDefinition, SourceHealth } from "../types";
import { librarySource } from "./library";
import { cityRecSource, santaClaraRecSource, cupertinoRecSource } from "./cityRec";
import { parksSource } from "./parks";

export const SOURCES: SourceDefinition[] = [
  librarySource,
  cityRecSource,
  santaClaraRecSource,
  cupertinoRecSource,
  parksSource,
];

export interface RefreshOutcome {
  sourceId: string;
  ok: boolean;
  eventCount: number;
  error?: string;
  durationMs: number;
}

async function upsertEvents(sourceId: string, events: NormalizedEvent[]): Promise<void> {
  // Replace strategy: delete this source's rows, insert fresh. Simpler than
  // upsert-and-prune, and our event volume is small.
  await sql`DELETE FROM events WHERE source_id = ${sourceId}`;
  for (const e of events) {
    await sql`
      INSERT INTO events (
        source_id, external_id, title, description,
        start_at, end_at, location, lat, lng,
        age_min_months, age_max_months, indoorness,
        cost, registration, schedule_label, url, evergreen
      ) VALUES (
        ${e.sourceId}, ${e.externalId}, ${e.title}, ${e.description},
        ${e.startAt.toISOString()}, ${e.endAt ? e.endAt.toISOString() : null},
        ${e.location}, ${e.lat}, ${e.lng},
        ${e.ageMinMonths}, ${e.ageMaxMonths}, ${e.indoorness},
        ${e.cost}, ${e.registration}, ${e.scheduleLabel}, ${e.url}, ${e.evergreen}
      )
      ON CONFLICT (source_id, external_id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        start_at = EXCLUDED.start_at,
        end_at = EXCLUDED.end_at,
        location = EXCLUDED.location,
        lat = EXCLUDED.lat,
        lng = EXCLUDED.lng,
        age_min_months = EXCLUDED.age_min_months,
        age_max_months = EXCLUDED.age_max_months,
        indoorness = EXCLUDED.indoorness,
        cost = EXCLUDED.cost,
        registration = EXCLUDED.registration,
        schedule_label = EXCLUDED.schedule_label,
        url = EXCLUDED.url,
        evergreen = EXCLUDED.evergreen,
        seen_at = NOW()
    `;
  }
}

export async function runSource(source: SourceDefinition): Promise<RefreshOutcome> {
  await ensureSchema();
  const started = Date.now();
  try {
    const result = await source.fetch();
    await upsertEvents(source.id, result.events);
    await sql`
      INSERT INTO sources (id, name, last_run_at, last_success_at, last_event_count, last_error)
      VALUES (${source.id}, ${source.name}, NOW(), NOW(), ${result.events.length}, NULL)
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        last_run_at = NOW(),
        last_success_at = NOW(),
        last_event_count = EXCLUDED.last_event_count,
        last_error = NULL
    `;
    return {
      sourceId: source.id,
      ok: true,
      eventCount: result.events.length,
      durationMs: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sql`
      INSERT INTO sources (id, name, last_run_at, last_error)
      VALUES (${source.id}, ${source.name}, NOW(), ${message})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        last_run_at = NOW(),
        last_error = EXCLUDED.last_error
    `;
    return {
      sourceId: source.id,
      ok: false,
      eventCount: 0,
      error: message,
      durationMs: Date.now() - started,
    };
  }
}

export async function runAllSources(): Promise<RefreshOutcome[]> {
  // Run in parallel — sources are independent.
  return Promise.all(SOURCES.map(runSource));
}

export async function getSourceHealth(): Promise<SourceHealth[]> {
  await ensureSchema();
  const { rows } = (await sql`SELECT id, name, last_run_at, last_success_at, last_error, last_event_count FROM sources`) as unknown as {
    rows: {
      id: string;
      name: string;
      last_run_at: string | null;
      last_success_at: string | null;
      last_error: string | null;
      last_event_count: number | null;
    }[];
  };

  // Merge with registry so sources that have never run still show up.
  const byId = new Map(rows.map((r) => [r.id, r]));
  const now = Date.now();
  const STALE_MS = 1000 * 60 * 60 * 6; // 6h
  return SOURCES.map((src) => {
    const r = byId.get(src.id);
    if (!r) {
      return {
        id: src.id,
        name: src.name,
        lastRunAt: null,
        lastSuccessAt: null,
        lastError: null,
        lastEventCount: null,
        status: "never_run",
      } satisfies SourceHealth;
    }
    const lastRun = r.last_run_at ? new Date(r.last_run_at) : null;
    const lastSuccess = r.last_success_at ? new Date(r.last_success_at) : null;
    let status: SourceHealth["status"] = "ok";
    if (!lastSuccess) status = "broken";
    else if (r.last_error) status = "broken";
    else if (now - lastSuccess.getTime() > STALE_MS) status = "stale";
    return {
      id: src.id,
      name: src.name,
      lastRunAt: lastRun,
      lastSuccessAt: lastSuccess,
      lastError: r.last_error,
      lastEventCount: r.last_event_count,
      status,
    } satisfies SourceHealth;
  });
}
