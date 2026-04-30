import { formatInTimeZone } from "date-fns-tz";
import type { RankedEvent } from "@/lib/rank";
import { config } from "@/lib/config";

const SOURCE_LABEL: Record<string, string> = {
  library: "Library",
  cityRec: "City Rec",
  parks: "Parks",
};

function fmt(d: Date, pattern: string) {
  return formatInTimeZone(d, config.timezone, pattern);
}

function CostBadge({ cost }: { cost: string }) {
  const isFree = /^free$/i.test(cost);
  const cls = isFree
    ? "bg-emerald-50 text-emerald-800 border-emerald-200"
    : "bg-amber-50 text-amber-900 border-amber-200";
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${cls}`}>
      {isFree ? "Free" : cost === "paid" ? "Paid" : cost}
    </span>
  );
}

function RegistrationBadge({ reg }: { reg: RankedEvent["registration"] }) {
  const map: Record<string, string> = {
    required: "bg-rose-50 text-rose-800 border-rose-200",
    "drop-in": "bg-sky-50 text-sky-800 border-sky-200",
    "walk-in": "bg-stone-100 text-stone-700 border-stone-200",
    unknown: "bg-stone-50 text-stone-500 border-stone-200",
  };
  const label: Record<string, string> = {
    required: "Signup required",
    "drop-in": "Drop-in OK",
    "walk-in": "Walk-in",
    unknown: "Signup unknown",
  };
  return (
    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${map[reg]}`}>
      {label[reg]}
    </span>
  );
}

export function EventCard({ event }: { event: RankedEvent }) {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;

  // Build a clear timing line.
  let timingPrimary: string;
  let timingSecondary: string | null = null;
  if (event.evergreen && event.source_id === "parks") {
    timingPrimary = "Open anytime";
  } else if (event.evergreen && event.source_id === "cityRec") {
    // Series: show date range.
    timingPrimary = end
      ? `${fmt(start, "MMM d")} – ${fmt(end, "MMM d")}`
      : `Starts ${fmt(start, "MMM d")}`;
    timingSecondary = "Multi-session class";
  } else {
    // Single-occurrence (library) — show day + start/end times.
    timingPrimary = end
      ? `${fmt(start, "EEE MMM d")} · ${fmt(start, "h:mm a")} – ${fmt(end, "h:mm a")}`
      : `${fmt(start, "EEE MMM d")} · ${fmt(start, "h:mm a")}`;
    const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
    if (minutes && minutes > 0) timingSecondary = `${minutes} min`;
  }

  return (
    <article className="border border-stone-200 rounded-lg p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-stone-500 mb-1">
            {SOURCE_LABEL[event.source_id] ?? event.source_id} ·{" "}
            {event.indoorness === "indoor"
              ? "Indoor"
              : event.indoorness === "outdoor"
              ? "Outdoor"
              : "Indoor / Outdoor"}
          </div>
          <h3 className="font-semibold text-base leading-snug">
            {event.url ? (
              <a
                href={event.url}
                target="_blank"
                rel="noreferrer"
                className="hover:underline"
              >
                {event.title}
              </a>
            ) : (
              event.title
            )}
          </h3>
          <div className="text-sm font-medium text-stone-800 mt-1">
            {timingPrimary}
            {timingSecondary && (
              <span className="text-stone-400 font-normal ml-1.5">
                · {timingSecondary}
              </span>
            )}
          </div>
          {event.location && (
            <div className="text-sm text-stone-500 mt-0.5">{event.location}</div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <CostBadge cost={event.cost} />
            <RegistrationBadge reg={event.registration} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-stone-900">
            {Math.round(event.score * 100) / 100}
          </div>
          {event.distanceMiles !== null && (
            <div className="text-xs text-stone-500">
              {event.distanceMiles.toFixed(1)} mi
            </div>
          )}
        </div>
      </div>

      {event.description && (
        <p className="text-sm text-stone-600 mt-3 line-clamp-3 whitespace-pre-line">
          {event.description}
        </p>
      )}

      {event.reasons.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {event.reasons.map((r, i) => (
            <li
              key={i}
              className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-700"
            >
              {r}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
