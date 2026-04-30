export type Indoorness = "indoor" | "outdoor" | "either";

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
