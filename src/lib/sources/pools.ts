import type { SourceDefinition, NormalizedEvent } from "../types";

// Pool recreation swim sessions — hardcoded seasonal schedules.
//
// Each PoolSession becomes one evergreen DB row with a scheduleLabel. The
// page.tsx date-range bucketing places it only on days within startDate…endDate.
//
// When a season ends the source shows as "stale" on /health (via scheduleEndsAt).
// Update sessions[] and scheduleEndsAt, then redeploy.

// ─── Helpers ──────────────────────────────────────────────────────────────

const DOW_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTime12(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return m === 0 ? `${h12} ${period}` : `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}

function scheduleLabel(days: number[], startTime: string, endTime: string): string {
  const dayStr = [...days].sort((a, b) => a - b).map((d) => DOW_ABBR[d]).join(", ");
  return `${dayStr} · ${fmtTime12(startTime)}–${fmtTime12(endTime)}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface PoolSession {
  title: string;
  startDate: string;  // "YYYY-MM-DD" — first occurrence
  endDate: string;    // "YYYY-MM-DD" — last occurrence
  days: number[];     // 0=Sun … 6=Sat
  startTime: string;  // "HH:MM" 24-hour Pacific
  endTime: string;    // "HH:MM" 24-hour Pacific
}

interface PoolConfig {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  url: string;
  /**
   * When this date passes, /health shows the source as stale so you know to
   * update the sessions for the new season.
   */
  scheduleEndsAt: Date;
  sessions: PoolSession[];
}

// ─── Factory ──────────────────────────────────────────────────────────────

function makePoolSource(cfg: PoolConfig): SourceDefinition {
  return {
    id: cfg.id,
    name: cfg.name,
    description: `Recreation swim at ${cfg.name} (hardcoded seasonal schedule)`,
    scheduleEndsAt: cfg.scheduleEndsAt,
    async fetch(): Promise<{ events: NormalizedEvent[] }> {
      const events: NormalizedEvent[] = cfg.sessions.map((s) => {
        // Pool season is always summer (PDT = -07:00). Using ISO offset strings
        // avoids any server-timezone ambiguity.
        const startAt = new Date(`${s.startDate}T${s.startTime}:00-07:00`);
        const endAt   = new Date(`${s.endDate}T${s.endTime}:00-07:00`);
        const label   = scheduleLabel(s.days, s.startTime, s.endTime);
        // Stable ID: date + sorted days + time, unique per session block.
        const externalId = `${s.startDate}-${[...s.days].sort().join("")}-${s.startTime.replace(":", "")}`;

        return {
          sourceId: cfg.id,
          externalId,
          title: s.title,
          description: "",
          startAt,
          endAt,
          location: cfg.location,
          lat: cfg.lat,
          lng: cfg.lng,
          ageMinMonths: 0,
          ageMaxMonths: 144,
          indoorness: "outdoor",
          cost: "paid",
          registration: "walk-in",
          scheduleLabel: label,
          url: cfg.url,
          evergreen: true,
        };
      });
      return { events };
    },
  };
}

// ─── Pool definitions ──────────────────────────────────────────────────────

// Mountain View — Rengstorff Park Aquatics Center
// Source: https://www.mountainview.gov/our-city/departments/community-services/recreation/aquatics-pools/recreation-swim
// Season: May 23 – Aug 31 2026
// To update: edit sessions[] below and bump scheduleEndsAt to end of next season.
export const mvPoolSource = makePoolSource({
  id: "mvPool",
  name: "MV Rengstorff Aquatic Center",
  location: "Rengstorff Park Aquatics Center, 201 Rengstorff Ave, Mountain View",
  lat: 37.4020,
  lng: -122.1050,
  url: "https://www.mountainview.gov/our-city/departments/community-services/recreation/aquatics-pools/recreation-swim",
  scheduleEndsAt: new Date("2026-09-01T00:00:00-07:00"),
  sessions: [
    // Pre-summer: Sat–Sun 1:30–6:30 PM (May 23 – Jun 14)
    {
      title: "Recreation Swim",
      startDate: "2026-05-23", endDate: "2026-06-14",
      days: [0, 6], startTime: "13:30", endTime: "18:30",
    },
    // Summer weekdays: Mon–Thu 2:30–5 PM (Jun 15 – Aug 31)
    {
      title: "Recreation Swim",
      startDate: "2026-06-15", endDate: "2026-08-31",
      days: [1, 2, 3, 4], startTime: "14:30", endTime: "17:00",
    },
    // Summer weekends: Sat–Sun 1:30–6:30 PM (Jun 15 – Aug 31)
    {
      title: "Recreation Swim",
      startDate: "2026-06-15", endDate: "2026-08-31",
      days: [0, 6], startTime: "13:30", endTime: "18:30",
    },
    // Night Rec Swim: Fri 5–7 PM (Jun 26, Jul 3, 10, 17, 24, 31)
    {
      title: "Night Recreation Swim",
      startDate: "2026-06-26", endDate: "2026-07-31",
      days: [5], startTime: "17:00", endTime: "19:00",
    },
  ],
});
