import type { SourceDefinition, NormalizedEvent } from "../types";

// Pool recreation swim sessions — hardcoded seasonal schedules.
//
// Each PoolSession becomes one evergreen DB row with a scheduleLabel. The
// page.tsx date-range bucketing places it only on days within startDate…endDate.
//
// When a season ends the source shows as "stale" on /sources (via scheduleEndsAt).
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
   * When this date passes, /sources shows the source as stale so you know to
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
    // Night Rec Swim: Fri 5–7 PM (Jun 26, Jul 3, 10, 17, 24, 31, Aug 7)
    {
      title: "Night Recreation Swim",
      startDate: "2026-06-26", endDate: "2026-08-07",
      days: [5], startTime: "17:00", endTime: "19:00",
    },
  ],
});

// Mountain View — Eagle Park Pool
// Source: https://www.mountainview.gov/our-city/departments/community-services/recreation/aquatics-pools/recreation-swim
// Season: Jun 15 – Aug 31 2026. Closed Jun 19 & Jul 3.
// To update: edit sessions[] below and bump scheduleEndsAt to end of next season.
export const eaglePoolSource = makePoolSource({
  id: "eaglePool",
  name: "MV Eagle Park Pool",
  location: "Eagle Park Pool, 401 Diana Ct, Mountain View",
  lat: 37.4036,
  lng: -122.0814,
  url: "https://www.mountainview.gov/our-city/departments/community-services/recreation/aquatics-pools/recreation-swim",
  scheduleEndsAt: new Date("2026-09-01T00:00:00-07:00"),
  sessions: [
    // Mon–Fri 12:30–2:30 PM (Jun 15 – Aug 31)
    // Note: closed Jun 19 (Fri) and Jul 3 (Fri)
    {
      title: "Recreation Swim",
      startDate: "2026-06-15", endDate: "2026-08-31",
      days: [1, 2, 3, 4, 5], startTime: "12:30", endTime: "14:30",
    },
  ],
});

// Santa Clara — Mary Gomez Park & Aquatic Center
// Source: https://www.santaclaraca.gov/our-city/departments-g-z/parks-recreation/recreation-programs/swimming
// Season: Jun 8 – Aug 30 2026
export const santaClaraGomezPoolSource = makePoolSource({
  id: "santaClaraGomezPool",
  name: "SC Mary Gomez Aquatic Center",
  location: "Mary Gomez Park & Aquatic Center, 651 Bucher Ave, Santa Clara",
  lat: 37.3533,
  lng: -121.9694,
  url: "https://www.santaclaraca.gov/our-city/departments-g-z/parks-recreation/recreation-programs/swimming",
  scheduleEndsAt: new Date("2026-09-01T00:00:00-07:00"),
  sessions: [
    // Jun 8 – Aug 1: Mon/Wed/Sun 1–4 PM
    {
      title: "Recreation Swim",
      startDate: "2026-06-08", endDate: "2026-08-01",
      days: [0, 1, 3], startTime: "13:00", endTime: "16:00",
    },
    // Aug 2 – Aug 30: Sun only 1–4 PM
    {
      title: "Recreation Swim",
      startDate: "2026-08-02", endDate: "2026-08-30",
      days: [0], startTime: "13:00", endTime: "16:00",
    },
  ],
});

// Santa Clara — Warburton Park & Aquatic Center
// Source: https://www.santaclaraca.gov/our-city/departments-g-z/parks-recreation/recreation-programs/swimming
// Season: Jun 8 – Aug 29 2026
export const santaClaraWarburtonPoolSource = makePoolSource({
  id: "santaClaraWarburtonPool",
  name: "SC Warburton Aquatic Center",
  location: "Warburton Park & Aquatic Center, 2250 Royal Dr, Santa Clara",
  lat: 37.3697,
  lng: -121.9517,
  url: "https://www.santaclaraca.gov/our-city/departments-g-z/parks-recreation/recreation-programs/swimming",
  scheduleEndsAt: new Date("2026-09-01T00:00:00-07:00"),
  sessions: [
    // Jun 8 – Jul 31: Tue/Thu/Fri/Sat 1–4 PM
    {
      title: "Recreation Swim",
      startDate: "2026-06-08", endDate: "2026-07-31",
      days: [2, 4, 5, 6], startTime: "13:00", endTime: "16:00",
    },
    // Aug 1 – Aug 29: Sat only 1–4 PM
    {
      title: "Recreation Swim",
      startDate: "2026-08-01", endDate: "2026-08-29",
      days: [6], startTime: "13:00", endTime: "16:00",
    },
  ],
});

// Cupertino — Blackberry Farm Pool
// Source: https://www.cupertino.gov/Parks-Recreation/Aquatics-and-Golf/Blackberry-Farm/Aquatics
// Season: late May – Labor Day 2026 (exact dates: verify each season)
export const cupertinoBlackberryPoolSource = makePoolSource({
  id: "cupertinoBlackberryPool",
  name: "Cupertino Blackberry Farm Pool",
  location: "Blackberry Farm Pool, 21979 San Fernando Ave, Cupertino",
  lat: 37.3168,
  lng: -122.0502,
  url: "https://www.cupertino.gov/Parks-Recreation/Aquatics-and-Golf/Blackberry-Farm/Aquatics",
  scheduleEndsAt: new Date("2026-09-08T00:00:00-07:00"),
  sessions: [
    // Tue–Fri noon–6 PM
    {
      title: "Recreation Swim",
      startDate: "2026-05-23", endDate: "2026-09-07",
      days: [2, 3, 4, 5], startTime: "12:00", endTime: "18:00",
    },
    // Sat–Sun 10 AM–6 PM
    {
      title: "Recreation Swim",
      startDate: "2026-05-23", endDate: "2026-09-07",
      days: [0, 6], startTime: "10:00", endTime: "18:00",
    },
  ],
});

// Daly City — Giammona Pool
// Source: https://www.dalycity.org/330/Aquatics
// Season: Jun–Aug 2026. Reservation required via dalycity.org/iplay.
export const dalyCityPoolSource = makePoolSource({
  id: "dalyCityPool",
  name: "Daly City Giammona Pool",
  location: "Giammona Pool, 131 Westmoor Ave, Daly City",
  lat: 37.6804,
  lng: -122.4690,
  url: "https://www.dalycity.org/330/Aquatics",
  scheduleEndsAt: new Date("2026-09-01T00:00:00-07:00"),
  sessions: [
    // Sat–Sun 12:30–2:30 PM (Jun 6 – Aug 30)
    {
      title: "Recreation Swim",
      startDate: "2026-06-06", endDate: "2026-08-30",
      days: [0, 6], startTime: "12:30", endTime: "14:30",
    },
  ],
});

// Campbell — Community Center Pool
// Source: https://www.campbellca.gov/1312/Recreation-Swim
// Season: Jun 16 – Aug 7 2026. Closed Jul 3–4.
export const campbellPoolSource = makePoolSource({
  id: "campbellPool",
  name: "Campbell Community Center Pool",
  location: "Campbell Community Center Pool, 1 W Campbell Ave, Campbell",
  lat: 37.2872,
  lng: -121.9509,
  url: "https://www.campbellca.gov/1312/Recreation-Swim",
  scheduleEndsAt: new Date("2026-08-08T00:00:00-07:00"),
  sessions: [
    // Tue–Fri 1:30–3 PM (Jun 16 – Aug 7). Closed Jul 3.
    {
      title: "Recreation Swim",
      startDate: "2026-06-16", endDate: "2026-08-07",
      days: [2, 3, 4, 5], startTime: "13:30", endTime: "15:00",
    },
    // Sat 12:30–2 PM — Social Hour Swim (Jun 21 – Aug 1). Closed Jul 4.
    {
      title: "Social Hour Swim",
      startDate: "2026-06-21", endDate: "2026-08-01",
      days: [6], startTime: "12:30", endTime: "14:00",
    },
  ],
});

// San Mateo — Joinville Swim Center
// Source: https://www.cityofsanmateo.org/3534/Aquatics
// Season: Jun 15 – Aug 8 2026
export const sanMateoJoinvillePoolSource = makePoolSource({
  id: "sanMateoJoinvillePool",
  name: "San Mateo Joinville Swim Center",
  location: "Joinville Swim Center, 2111 Kehoe Ave, San Mateo",
  lat: 37.5621,
  lng: -122.2983,
  url: "https://www.cityofsanmateo.org/3534/Aquatics",
  scheduleEndsAt: new Date("2026-08-09T00:00:00-07:00"),
  sessions: [
    // Mon–Thu 1–3:30 PM
    {
      title: "Recreation Swim",
      startDate: "2026-06-15", endDate: "2026-08-08",
      days: [1, 2, 3, 4], startTime: "13:00", endTime: "15:30",
    },
    // Sat 1:30–5 PM
    {
      title: "Recreation Swim",
      startDate: "2026-06-20", endDate: "2026-08-08",
      days: [6], startTime: "13:30", endTime: "17:00",
    },
  ],
});

// San Mateo — King Swim Center
// Source: https://www.cityofsanmateo.org/3534/Aquatics
// Season: Jun 15 – Aug 8 2026
export const sanMateoKingPoolSource = makePoolSource({
  id: "sanMateoKingPool",
  name: "San Mateo King Swim Center",
  location: "King Swim Center, 725 Monte Diablo Ave, San Mateo",
  lat: 37.5648,
  lng: -122.3141,
  url: "https://www.cityofsanmateo.org/3534/Aquatics",
  scheduleEndsAt: new Date("2026-08-09T00:00:00-07:00"),
  sessions: [
    // Mon–Thu 1–3:30 PM
    {
      title: "Recreation Swim",
      startDate: "2026-06-15", endDate: "2026-08-08",
      days: [1, 2, 3, 4], startTime: "13:00", endTime: "15:30",
    },
    // Sat 1:30–5 PM
    {
      title: "Recreation Swim",
      startDate: "2026-06-20", endDate: "2026-08-08",
      days: [6], startTime: "13:30", endTime: "17:00",
    },
    // Sun noon–4 PM (King only)
    {
      title: "Recreation Swim",
      startDate: "2026-06-21", endDate: "2026-08-08",
      days: [0], startTime: "12:00", endTime: "16:00",
    },
  ],
});
