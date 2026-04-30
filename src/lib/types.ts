export type Indoorness = "indoor" | "outdoor" | "either";

// "free" | "paid" | "$15+" — kept loose so sources can pass formatted prefixes.
export type Cost = string;

export type Registration = "required" | "walk-in" | "drop-in" | "unknown";

export interface NormalizedEvent {
  sourceId: string;
  externalId: string;
  title: string;
  description: string | null;
  startAt: Date;
  endAt: Date | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  indoorness: Indoorness;
  cost: Cost;
  registration: Registration;
  /** Human-readable meeting pattern, e.g. "Sun · 9:00–9:30 AM". Null when unknown. */
  scheduleLabel: string | null;
  url: string | null;
  evergreen: boolean; // true for parks/places without scheduled times
  raw?: unknown;
}

export interface SourceResult {
  events: NormalizedEvent[];
}

export interface SourceDefinition {
  id: string;
  name: string;
  description: string;
  fetch(): Promise<SourceResult>;
}

export interface SourceHealth {
  id: string;
  name: string;
  lastRunAt: Date | null;
  lastSuccessAt: Date | null;
  lastError: string | null;
  lastEventCount: number | null;
  status: "ok" | "stale" | "broken" | "never_run";
}
