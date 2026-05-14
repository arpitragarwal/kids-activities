// Default child birth date. Used to compute age dynamically so the default
// stays correct as time passes. Override with CHILD_BIRTH_YYYY_MM (e.g.
// "2024-10") or CHILD_AGE_MONTHS (takes precedence if set).
const DEFAULT_BIRTH_YEAR_MONTH = process.env.CHILD_BIRTH_YYYY_MM ?? "2024-10";

function ageMonthsFromBirthYM(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
  const now = new Date();
  const months = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  return Math.max(0, months);
}

// Hardcoded child + home profile. Override via env vars without editing this file.
export const config = {
  child: {
    name: "Kiddo",
    get ageMonths(): number {
      const override = process.env.CHILD_AGE_MONTHS;
      if (override && Number.isFinite(Number(override))) return Number(override);
      return ageMonthsFromBirthYM(DEFAULT_BIRTH_YEAR_MONTH);
    },
  },
  home: {
    // Defaults to Mountain View City Hall. Replace with your actual home.
    lat: Number(process.env.HOME_LAT ?? 37.3861),
    lng: Number(process.env.HOME_LNG ?? -122.0839),
  },
  // Soft cap for "too far" — anything beyond this gets a penalty in ranking.
  maxDistanceMiles: 8,
  // Window of events to display.
  lookbackDays: 1,
  lookaheadDays: 14,
  timezone: "America/Los_Angeles",
};

export const ageBucket = (months: number): "infant" | "toddler" | "preschool" => {
  if (months < 12) return "infant";
  if (months < 36) return "toddler";
  return "preschool";
};
