// Parses the human-readable schedule_label (built in cityRec.ts) back into a
// structured set of meeting days + times so the UI can filter by "today".
//
// Examples this needs to handle:
//   "Sun · 9 AM–9:30 AM"
//   "Weekdays · 9 AM–12 PM"
//   "Mon, Tue, Wed, Thu · 1 PM–4 PM"
//   "Sat, Sun · 10–11 AM"
//   "Sun · 9–9:30 AM / Tue · 4–5 PM"  (multiple time blocks, joined with " / ")

const DAY_TO_DOW: Record<string, number> = {
  sun: 0, sunday: 0,
  mon: 1, monday: 1,
  tue: 2, tues: 2, tuesday: 2,
  wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5,
  sat: 6, saturday: 6,
};

const DAY_GROUPS: Record<string, number[]> = {
  weekdays: [1, 2, 3, 4, 5],
  weekday: [1, 2, 3, 4, 5],
  weekends: [0, 6],
  weekend: [0, 6],
  daily: [0, 1, 2, 3, 4, 5, 6],
};

export interface ParsedSchedule {
  /** Sorted unique weekday integers, 0=Sun..6=Sat. Empty if unparseable. */
  days: number[];
  /** Minutes-since-midnight of the earliest meeting start across blocks. Null if unknown. */
  startMinutes: number | null;
  /** Minutes-since-midnight of the latest meeting end across blocks. Null if unknown. */
  endMinutes: number | null;
}

function parseTime(s: string): number | null {
  // Accept "9 AM", "9:30 AM", "12 PM" (case-insensitive). Anything else → null.
  const m = s.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const period = m[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  if (period === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function parseDayToken(tok: string): number[] {
  const t = tok.trim().toLowerCase();
  if (DAY_GROUPS[t]) return DAY_GROUPS[t];
  if (DAY_TO_DOW[t] !== undefined) return [DAY_TO_DOW[t]];
  return [];
}

function parseBlock(block: string): { days: number[]; start: number | null; end: number | null } {
  // "Sun · 9 AM–9:30 AM" — split on "·".
  const parts = block.split("·");
  if (parts.length < 1) return { days: [], start: null, end: null };
  const dayPart = parts[0] ?? "";
  const timePart = parts[1] ?? "";

  const days = new Set<number>();
  for (const tok of dayPart.split(/[,&]/)) {
    for (const d of parseDayToken(tok)) days.add(d);
  }

  // Time can have one en-dash, em-dash, or hyphen. The start side may omit
  // AM/PM (e.g., "10–11 AM"), in which case we infer from the end.
  let start: number | null = null;
  let end: number | null = null;
  const tm = timePart.trim().match(/^(.*?)[–—-](.*)$/);
  if (tm) {
    let s = tm[1].trim();
    const e = tm[2].trim();
    end = parseTime(e);
    if (!/AM|PM/i.test(s) && /AM|PM/i.test(e)) {
      // Inherit AM/PM from the end side.
      const period = /PM/i.test(e) ? "PM" : "AM";
      s = `${s} ${period}`;
    }
    start = parseTime(s);
  }
  return { days: [...days], start, end };
}

export function parseScheduleLabel(label: string | null | undefined): ParsedSchedule {
  if (!label) return { days: [], startMinutes: null, endMinutes: null };
  const days = new Set<number>();
  let earliestStart: number | null = null;
  let latestEnd: number | null = null;
  for (const block of label.split("/")) {
    const b = parseBlock(block);
    for (const d of b.days) days.add(d);
    if (b.start !== null) earliestStart = earliestStart === null ? b.start : Math.min(earliestStart, b.start);
    if (b.end !== null) latestEnd = latestEnd === null ? b.end : Math.max(latestEnd, b.end);
  }
  return {
    days: [...days].sort((a, b) => a - b),
    startMinutes: earliestStart,
    endMinutes: latestEnd,
  };
}

/** True if the schedule includes the given weekday (0=Sun..6=Sat). */
export function meetsOn(label: string | null | undefined, dow: number): boolean {
  const p = parseScheduleLabel(label);
  if (p.days.length === 0) return true; // unparseable — don't hide it
  return p.days.includes(dow);
}
