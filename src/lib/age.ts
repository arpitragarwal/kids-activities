// Age formatting. Under 2yo we keep months (granularity matters for storytimes
// like "0-18mo"); from 2yo onward we switch to years.

export function formatAge(months: number): string {
  if (months < 0) return "?";
  if (months < 24) return `${months}m`;
  const years = months / 12;
  // Whole years -> "3y"; otherwise one decimal -> "3.5y".
  return Number.isInteger(years) ? `${years}y` : `${years.toFixed(1)}y`;
}

export function formatAgeRange(minMonths: number, maxMonths: number): string {
  return `${formatAge(minMonths)}–${formatAge(maxMonths)}`;
}

export function splitYearsMonths(totalMonths: number): { years: number; months: number } {
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  return { years: y, months: m };
}
