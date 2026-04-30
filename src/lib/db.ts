import { neon } from "@neondatabase/serverless";

const url =
  process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? process.env.POSTGRES_PRISMA_URL;
if (!url) {
  throw new Error(
    "Set POSTGRES_URL (or DATABASE_URL) — get a free connection string at https://neon.tech",
  );
}

// Tagged template — `fullResults` keeps the @vercel/postgres-style { rows } shape.
export const sql = neon(url, { fullResults: true });

let initPromise: Promise<void> | null = null;

// Idempotent schema setup. Called once per process.
export async function ensureSchema(): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        last_run_at TIMESTAMPTZ,
        last_success_at TIMESTAMPTZ,
        last_error TEXT,
        last_event_count INTEGER
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS events (
        source_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        start_at TIMESTAMPTZ NOT NULL,
        end_at TIMESTAMPTZ,
        location TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        age_min_months INTEGER,
        age_max_months INTEGER,
        indoorness TEXT NOT NULL DEFAULT 'either',
        url TEXT,
        evergreen BOOLEAN NOT NULL DEFAULT FALSE,
        seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (source_id, external_id)
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS events_start_at_idx ON events (start_at)`;
    // Additive migrations — safe to re-run.
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS cost TEXT NOT NULL DEFAULT 'unknown'`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS registration TEXT NOT NULL DEFAULT 'unknown'`;
    await sql`
      CREATE TABLE IF NOT EXISTS weather_cache (
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        fetched_at TIMESTAMPTZ NOT NULL,
        hourly_json JSONB NOT NULL,
        PRIMARY KEY (lat, lng)
      )
    `;
  })().catch((err) => {
    initPromise = null;
    throw err;
  });
  return initPromise;
}
