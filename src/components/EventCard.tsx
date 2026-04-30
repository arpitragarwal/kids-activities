import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import type { RankedEvent } from "@/lib/rank";
import { config } from "@/lib/config";

const SOURCE_LABEL: Record<string, string> = {
  library: "Library",
  cityRec: "City Rec",
  parks: "Parks",
};

function formatTime(d: Date) {
  return formatInTimeZone(d, config.timezone, "EEE MMM d · h:mm a");
}

export function EventCard({ event }: { event: RankedEvent }) {
  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;
  const when = event.evergreen
    ? "Evergreen — visit anytime"
    : end
    ? `${formatTime(start)} – ${formatInTimeZone(end, config.timezone, "h:mm a")}`
    : formatTime(start);

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
          <div className="text-sm text-stone-600 mt-1">{when}</div>
          {event.location && (
            <div className="text-sm text-stone-500 mt-0.5">{event.location}</div>
          )}
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
