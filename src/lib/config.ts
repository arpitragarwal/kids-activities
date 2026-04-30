// Hardcoded child + home profile. Override via env vars without editing this file.
export const config = {
  child: {
    name: "Kiddo",
    ageMonths: Number(process.env.CHILD_AGE_MONTHS ?? 36), // default 3yo
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
