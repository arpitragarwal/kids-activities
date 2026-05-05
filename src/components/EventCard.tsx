import { formatInTimeZone } from "date-fns-tz";
import type { RankedEvent } from "@/lib/rank";
import { formatAgeRange } from "@/lib/age";
import { config } from "@/lib/config";

function fmt(d: Date, pattern: string) {
  return formatInTimeZone(d, config.timezone, pattern);
}

// ─── Age fit ──────────────────────────────────────────────────────────────

type AgeFit = "fit" | "borderline" | "out" | "unknown";

function getAgeFit(event: RankedEvent, childAgeMonths: number): AgeFit {
  const { age_min_months: min, age_max_months: max } = event;
  if (min === null && max === null) return "unknown";
  if (childAgeMonths >= min! && childAgeMonths <= max!) return "fit";
  const off = childAgeMonths < min! ? min! - childAgeMonths : childAgeMonths - max!;
  return off <= 6 ? "borderline" : "out";
}

const AGE_FIT_RING: Record<AgeFit, string> = {
  fit:        "border-emerald-400 bg-emerald-50",
  borderline: "border-amber-400 bg-amber-50",
  out:        "border-stone-300 bg-transparent",
  unknown:    "border-stone-200 bg-transparent",
};

const AGE_FIT_TITLE: Record<AgeFit, string> = {
  fit:        "Age fits your child",
  borderline: "Close to age range (within 6 months)",
  out:        "Outside your child's age range",
  unknown:    "Age range not specified",
};

function AgeFitDot({ fit }: { fit: AgeFit }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full border-2 shrink-0 ${AGE_FIT_RING[fit]}`}
      title={AGE_FIT_TITLE[fit]}
    />
  );
}

// ─── Indoorness ───────────────────────────────────────────────────────────

const ACCENT_BAR: Record<string, string> = {
  indoor:  "bg-sky-400",
  outdoor: "bg-emerald-500",
  either:  "bg-amber-400",
};

const INDOOR_CHIP: Record<string, string> = {
  indoor:  "bg-sky-50 text-sky-700 border-sky-200",
  outdoor: "bg-emerald-50 text-emerald-700 border-emerald-200",
  either:  "bg-amber-50 text-amber-700 border-amber-200",
};

// ─── Badges ───────────────────────────────────────────────────────────────

function CostBadge({ cost }: { cost: string }) {
  const isFree = /^free$/i.test(cost);
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded border font-medium ${
        isFree
          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
          : "bg-amber-50 text-amber-800 border-amber-200"
      }`}
    >
      {isFree ? "Free" : cost === "paid" ? "Paid" : cost}
    </span>
  );
}

function RegistrationBadge({ reg }: { reg: RankedEvent["registration"] }) {
  const styles: Record<string, string> = {
    required:  "bg-rose-50 text-rose-700 border-rose-200",
    "drop-in": "bg-sky-50 text-sky-700 border-sky-200",
    "walk-in": "bg-stone-100 text-stone-600 border-stone-200",
    unknown:   "bg-stone-50 text-stone-400 border-stone-200",
  };
  const labels: Record<string, string> = {
    required:  "Signup required",
    "drop-in": "Drop-in OK",
    "walk-in": "Walk-in",
    unknown:   "Signup unknown",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded border font-medium ${styles[reg]}`}>
      {labels[reg]}
    </span>
  );
}

// ─── Source label ─────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  // Recreation
  cityRec:               "City Rec",
  santaClaraRec:         "City Rec",
  cupertinoRec:          "City Rec",
  milpitasRec:           "City Rec",
  sanJoseRec:            "City Rec",
  fremontRec:            "City Rec",
  redwoodCityRec:        "City Rec",
  dalyCityRec:           "City Rec",
  sfRec:                 "City Rec",
  // Libraries
  library:               "Library",
  sunnyvaleLibrary:      "Library",
  losGatosLibrary:       "Library",
  paloAltoLibrary:       "Library",
  scclLibrary:           "Library",
  sanJoseLibrary:        "Library",
  alamedaCountyLibrary:  "Library",
  sanMateoCountyLibrary: "Library",
  // Places
  parks:                 "Parks",
};

// ─── EventCard ────────────────────────────────────────────────────────────

export function EventCard({
  event,
  childAgeMonths,
}: {
  event: RankedEvent;
  childAgeMonths?: number;
}) {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;

  // ── Timing ──
  let timingPrimary: string;
  let timingSecondary: string | null = null;

  if (event.evergreen && event.source_id === "parks") {
    timingPrimary = "Open anytime";
  } else if (event.evergreen && event.source_id !== "parks") {
    if (event.schedule_label) {
      timingPrimary = event.schedule_label;
      timingSecondary = end
        ? `${fmt(start, "MMM d")} – ${fmt(end, "MMM d")}`
        : `From ${fmt(start, "MMM d")}`;
    } else {
      timingPrimary = end
        ? `${fmt(start, "MMM d")} – ${fmt(end, "MMM d")}`
        : `Starts ${fmt(start, "MMM d")}`;
      timingSecondary = "Multi-session class";
    }
  } else {
    timingPrimary = end
      ? `${fmt(start, "EEE MMM d")} · ${fmt(start, "h:mm a")} – ${fmt(end, "h:mm a")}`
      : `${fmt(start, "EEE MMM d")} · ${fmt(start, "h:mm a")}`;
    const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
    if (minutes && minutes > 0) timingSecondary = `${minutes} min`;
  }

  // ── Age fit ──
  const ageFit: AgeFit = childAgeMonths !== undefined ? getAgeFit(event, childAgeMonths) : "unknown";
  const ageRange =
    event.age_min_months !== null && event.age_max_months !== null
      ? formatAgeRange(event.age_min_months, event.age_max_months)
      : null;

  const indoorLabel =
    event.indoorness === "indoor" ? "Indoor" :
    event.indoorness === "outdoor" ? "Outdoor" :
    "In/Out";

  return (
    <article className="relative bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150">
      {/* Left accent bar — color by indoorness */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] ${ACCENT_BAR[event.indoorness] ?? "bg-stone-300"}`} />

      <div className="pl-4 pr-4 pt-3.5 pb-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Meta row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <AgeFitDot fit={ageFit} />
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-stone-400">
                {SOURCE_LABEL[event.source_id] ?? event.source_id}
              </span>
              <span className="w-[3px] h-[3px] rounded-full bg-stone-300 shrink-0" />
              <span
                className={`text-[10.5px] font-medium px-1.5 py-0.5 rounded-full border ${
                  INDOOR_CHIP[event.indoorness] ?? "bg-stone-100 text-stone-600 border-stone-200"
                }`}
              >
                {indoorLabel}
              </span>
              {ageRange && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-stone-300 shrink-0" />
                  <span className="text-[10.5px] text-stone-400">{ageRange}</span>
                </>
              )}
            </div>

            {/* Title */}
            <h3 className="font-semibold text-[15px] leading-snug tracking-tight text-stone-900 mb-1">
              {event.url ? (
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline decoration-stone-300"
                >
                  {event.title}
                </a>
              ) : (
                event.title
              )}
            </h3>

            {/* Timing */}
            <div className="flex items-center gap-1.5 flex-wrap text-[13px] font-medium text-stone-600">
              {timingPrimary}
              {timingSecondary && (
                <span className="text-stone-400 font-normal">· {timingSecondary}</span>
              )}
            </div>

            {/* Location + distance */}
            {event.location && (() => {
              const mapsUrl = event.lat != null && event.lng != null
                ? `https://maps.google.com/?q=${event.lat},${event.lng}`
                : `https://maps.google.com/?q=${encodeURIComponent(event.location)}`;
              return (
                <div className="flex items-center gap-1 text-xs text-stone-400 mt-0.5">
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" className="shrink-0">
                    <path d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 2.65 3.5 6.5 3.5 6.5s3.5-3.85 3.5-6.5C9.5 2.567 7.933 1 6 1zm0 4.75A1.25 1.25 0 1 1 6 3.25a1.25 1.25 0 0 1 0 2.5z" />
                  </svg>
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline hover:text-stone-600 transition-colors"
                  >
                    {event.location}
                  </a>
                  {event.distanceMiles != null && (
                    <span className="text-stone-400">· {event.distanceMiles.toFixed(1)} mi</span>
                  )}
                </div>
              );
            })()}

            {/* Badges */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              <CostBadge cost={event.cost} />
              <RegistrationBadge reg={event.registration} />
            </div>
          </div>

        </div>

        {/* Description */}
        {event.description && (
          <p className="text-sm text-stone-500 mt-3 line-clamp-3 leading-relaxed">
            {event.description}
          </p>
        )}

        {/* Ranking reasons */}
        {event.reasons.length > 0 && (
          <ul className="mt-2.5 flex flex-wrap gap-1.5">
            {event.reasons.map((r, i) => (
              <li
                key={i}
                className="text-[11.5px] px-2.5 py-0.5 rounded-full bg-stone-50 border border-stone-200 text-stone-500"
              >
                {r}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
