"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import type { RankedEvent } from "@/lib/rank";
import { formatAgeRange } from "@/lib/age";
import { config } from "@/lib/config";

function fmt(d: Date, pattern: string) {
  return formatInTimeZone(d, config.timezone, pattern);
}

// ─── Category icon ────────────────────────────────────────────────────────

const LIBRARY_IDS = new Set([
  "library", "sunnyvaleLibrary", "losGatosLibrary",
  "paloAltoLibrary", "scclLibrary", "sanJoseLibrary",
  "alamedaCountyLibrary", "sanMateoCountyLibrary",
]);

type ActivityKind =
  | "library" | "parks"
  | "swim" | "gymnastics" | "sports" | "dance" | "art" | "music" | "yoga"
  | "activity";

function activityKind(sourceId: string, title: string, description?: string | null): ActivityKind {
  if (LIBRARY_IDS.has(sourceId)) return "library";
  if (sourceId === "parks") return "parks";

  // Check title first, then fall back to description
  const sources = [title, description ?? ""].map((s) => s.toLowerCase());
  function has(kw: string) { return sources.some((s) => s.includes(kw)); }

  if (has("place to play") || has("open play") || has("play space") || has("play gym") || has("playroom") || has("playground")) return "parks";
  if (has("swim") || has("pool") || has("aqua") || has("water play") || has("splash")) return "swim";
  if (has("gymnastic") || has("tumbl") || has("acrobat") || has("cheer") || has("cartwheel") || has("handstand") || has("balance beam") || has("vault")) return "gymnastics";
  if (has("soccer") || has("basketball") || has("baseball") || has("tennis") || has("lacrosse") || has("volleyball") || has("football") || has("sport") || has("tball") || has("t-ball") || has("kick") || has("batting")) return "sports";
  if (has("danc") || has("ballet") || has("hip hop") || has("hula") || has("zumba") || has("movement class") || has("creative movement")) return "dance";
  if (has("art") || has("craft") || has("paint") || has("draw") || has("sculpt") || has("ceramic") || has("collage") || has("origami")) return "art";
  if (has("music") || has("sing") || has("choir") || has("drum") || has("piano") || has("guitar") || has("violin") || has("instrument") || has("storytime") || has("story time") || has("lullaby") || has("rhyme") || has("song")) return "music";
  if (has("yoga") || has("pilates") || has("mindful") || has("stretch") || has("meditation")) return "yoga";
  return "activity";
}

function CategoryIcon({ sourceId, title, description }: { sourceId: string; title: string; description?: string | null }) {
  const kind = activityKind(sourceId, title, description);
  const common = {
    width: 20, height: 20, viewBox: "0 0 24 24",
    fill: "none" as const, stroke: "currentColor",
    strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
  };
  switch (kind) {
    case "library":
      return (
        <svg {...common}>
          <path d="M12 7.5C10 6 7.5 5.5 4 5.5v12c3.5 0 6 .5 8 2" />
          <path d="M12 7.5C14 6 16.5 5.5 20 5.5v12c-3.5 0-6 .5-8 2" />
          <path d="M12 7.5v12" />
        </svg>
      );
    case "parks":
      return (
        <svg {...common}>
          <path d="M4 20L8 5h8l4 15" />
          <path d="M6 5h12" />
          <path d="M10 5l-1.5 9M14 5l1.5 9" />
          <path d="M8 14h8" strokeWidth={1.4} />
        </svg>
      );
    case "swim":
      return (
        <svg {...common}>
          {/* wave lines */}
          <path d="M3 9 Q6 6 9 9 Q12 12 15 9 Q18 6 21 9" />
          <path d="M3 15 Q6 12 9 15 Q12 18 15 15 Q18 12 21 15" />
        </svg>
      );
    case "gymnastics":
      return (
        <svg {...common}>
          {/* figure in bridge: head, arced body, feet planted */}
          <circle cx="12" cy="5" r="2" />
          <path d="M7 19 Q8 12 12 9 Q16 12 17 19" />
          <path d="M5 17 L7 19 M19 17 L17 19" />
        </svg>
      );
    case "sports":
      return (
        <svg {...common}>
          {/* ball with stitch lines */}
          <circle cx="12" cy="12" r="8" />
          <path d="M7.5 5.5 Q10 12 7.5 18.5" />
          <path d="M16.5 5.5 Q14 12 16.5 18.5" />
          <path d="M4 10 Q12 8 20 10" />
          <path d="M4 14 Q12 16 20 14" />
        </svg>
      );
    case "dance":
      return (
        <svg {...common}>
          {/* figure with one arm and leg raised */}
          <circle cx="12" cy="4.5" r="2" />
          <path d="M12 6.5 L12 13" />
          <path d="M12 9 L8 7 M12 9 L16 7" />
          <path d="M12 13 L9 18 M12 13 L16 18" />
        </svg>
      );
    case "art":
      return (
        <svg {...common}>
          {/* pencil */}
          <path d="M17 3 L21 7 L9 19 L5 19 L5 15 Z" />
          <path d="M15 5 L19 9" />
        </svg>
      );
    case "music":
      return (
        <svg {...common}>
          <path d="M9 17.5V6l10-2v11.5" />
          <circle cx="7" cy="17.5" r="2.2" />
          <circle cx="17" cy="15.5" r="2.2" />
        </svg>
      );
    case "yoga":
      return (
        <svg {...common}>
          {/* seated meditation figure */}
          <circle cx="12" cy="5" r="2" />
          <path d="M8 18 Q12 12 16 18" />
          <path d="M6 13 Q12 10 18 13" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          {/* calendar with a dot — generic class/event */}
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <path d="M3 9h18" />
          <path d="M8 2v4M16 2v4" />
          <circle cx="12" cy="14" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

// ─── Labels ───────────────────────────────────────────────────────────────

const SOURCE_LABEL: Record<string, string> = {
  cityRec: "City Rec", santaClaraRec: "City Rec", cupertinoRec: "City Rec",
  milpitasRec: "City Rec", sanJoseRec: "City Rec", fremontRec: "City Rec",
  redwoodCityRec: "City Rec", dalyCityRec: "City Rec", sfRec: "City Rec",
  library: "Library", sunnyvaleLibrary: "Library", losGatosLibrary: "Library",
  paloAltoLibrary: "Library", scclLibrary: "Library", sanJoseLibrary: "Library",
  alamedaCountyLibrary: "Library", sanMateoCountyLibrary: "Library",
  parks: "Parks",
};

const INDOOR_CHIP: Record<string, string> = {
  indoor:  "bg-sky-50 text-sky-700",
  outdoor: "bg-emerald-50 text-emerald-700",
  either:  "bg-amber-50 text-amber-700",
};

function RegTag({ reg }: { reg: RankedEvent["registration"] }) {
  if (reg === "required")
    return <span className="text-[11px] font-medium text-rose-700 whitespace-nowrap">Signup required</span>;
  if (reg === "drop-in")
    return <span className="text-[11px] font-medium text-sky-700 whitespace-nowrap">Drop-in OK</span>;
  if (reg === "walk-in")
    return <span className="text-[11px] font-medium text-stone-500 whitespace-nowrap">Walk-in</span>;
  return null;
}

function CostTag({ cost }: { cost: string }) {
  const isFree = /^free$/i.test(cost);
  return (
    <span className={`text-[11px] font-semibold ${isFree ? "text-emerald-700" : "text-amber-800"}`}>
      {isFree ? "Free" : cost === "paid" ? "Paid" : cost}
    </span>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────

export function EventCard({
  event,
  childAgeMonths: _childAgeMonths,
  isTopPick = false,
  defaultExpanded = false,
}: {
  event: RankedEvent;
  childAgeMonths?: number;
  isTopPick?: boolean;
  defaultExpanded?: boolean;
}) {
  const [open, setOpen] = useState(defaultExpanded);

  const start = new Date(event.start_at);
  const end = event.end_at ? new Date(event.end_at) : null;

  // ── Timing ──
  let timingPrimary: string;
  let timingSecondary: string | null = null;

  if (event.evergreen && event.source_id === "parks") {
    timingPrimary = "Open anytime";
  } else if (event.evergreen) {
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
      ? `${fmt(start, "h:mm")} – ${fmt(end, "h:mm a")}`
      : fmt(start, "h:mm a");
    const minutes = end ? Math.round((end.getTime() - start.getTime()) / 60000) : null;
    if (minutes && minutes > 0) timingSecondary = `${minutes} min`;
  }

  // ── Status ──
  const now = new Date();
  const hasEnded = !event.evergreen && end !== null && end < now;
  const isOngoing = !event.evergreen && start <= now && (end === null || end >= now);

  const ageRange =
    event.age_min_months !== null && event.age_max_months !== null
      ? formatAgeRange(event.age_min_months, event.age_max_months)
      : null;

  const indoorLabel =
    event.indoorness === "indoor" ? "Indoor" :
    event.indoorness === "outdoor" ? "Outdoor" : "In/Out";

  const sourceLabel = SOURCE_LABEL[event.source_id] ?? event.source_id;

  const mapsUrl = event.lat != null && event.lng != null
    ? `https://maps.google.com/?q=${event.lat},${event.lng}`
    : `https://maps.google.com/?q=${encodeURIComponent(event.location ?? "")}`;

  return (
    <article
      className={`relative bg-white border rounded-xl overflow-hidden transition-all duration-150 ${
        open ? "border-stone-300 shadow-sm" : "border-stone-200 hover:border-stone-300"
      }`}
    >
      {/* Left accent rail */}
      {isOngoing ? (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500" aria-hidden="true" />
      ) : isTopPick ? (
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-400" aria-hidden="true" />
      ) : null}

      {/* Collapsed row */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-stone-50/60 transition-colors ${isTopPick || isOngoing ? "pl-3.5" : ""}`}
      >
        {/* Category icon */}
        <span className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center bg-stone-100 text-stone-600">
          <CategoryIcon sourceId={event.source_id} title={event.title} description={event.description} />
        </span>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <h3 className="font-semibold text-[14.5px] tracking-tight text-stone-900 truncate flex-1 min-w-0">
              {event.title}
            </h3>
            {ageRange && (
              <span className="text-[12px] font-medium text-stone-400 tabular-nums shrink-0 whitespace-nowrap">
                {ageRange}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 text-[12.5px] text-stone-500 mt-0.5 flex-wrap">
            {isOngoing && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Now
              </span>
            )}
            {hasEnded && (
              <span className="text-[11px] font-medium text-stone-400 whitespace-nowrap">Ended</span>
            )}
            <span className="font-medium text-stone-700 truncate min-w-0 max-w-[55%]">
              {timingPrimary}
            </span>
            <span className="text-stone-300" aria-hidden="true">·</span>
            <span className={`px-1.5 rounded text-[11px] font-medium ${INDOOR_CHIP[event.indoorness] ?? "bg-stone-100 text-stone-600"}`}>
              {indoorLabel}
            </span>
            <RegTag reg={event.registration} />
          </div>
        </div>

        {/* Chevron */}
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none"
          className={`shrink-0 text-stone-400 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Expanded panel */}
      {open && (
        <div className="px-3 pb-3.5 pt-0.5 border-t border-stone-100">
          <div className="pl-[48px]">

            {/* Top pick chip */}
            {isTopPick && event.reasons.length > 0 && (
              <div className="mt-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5">
                <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 1l1.8 3.6L14 5.4l-3 2.9.7 4.1L8 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z" />
                </svg>
                {event.reasons[0]}
              </div>
            )}

            {/* Source · duration · cost */}
            <div className="flex items-center gap-1.5 flex-wrap mt-3 mb-1">
              <span className="text-[10.5px] font-semibold uppercase tracking-wider text-stone-400 whitespace-nowrap">
                {sourceLabel}
              </span>
              {timingSecondary && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-stone-300" aria-hidden="true" />
                  <span className="text-[10.5px] text-stone-400 whitespace-nowrap">{timingSecondary}</span>
                </>
              )}
              <span className="w-[3px] h-[3px] rounded-full bg-stone-300" aria-hidden="true" />
              <CostTag cost={event.cost} />
            </div>

            {/* Location + distance */}
            {event.location && (
              <div className="flex items-center gap-1 text-[12.5px] text-stone-500 mt-1">
                <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor" className="shrink-0">
                  <path d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 2.65 3.5 6.5 3.5 6.5s3.5-3.85 3.5-6.5C9.5 2.567 7.933 1 6 1zm0 4.75A1.25 1.25 0 1 1 6 3.25a1.25 1.25 0 0 1 0 2.5z" />
                </svg>
                <a href={mapsUrl} target="_blank" rel="noreferrer" className="hover:underline decoration-stone-300 truncate">
                  {event.location}
                </a>
                {event.distanceMiles != null && (
                  <span className="text-stone-400 whitespace-nowrap shrink-0">· {event.distanceMiles.toFixed(1)} mi</span>
                )}
              </div>
            )}

            {/* Description */}
            {event.description && (
              <p className="text-[13px] text-stone-600 mt-2.5 leading-relaxed line-clamp-3">
                {event.description}
              </p>
            )}

            {/* Ranking reasons */}
            {event.reasons.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {event.reasons.map((r, i) => (
                  <li key={i} className="text-[11.5px] px-2.5 py-0.5 rounded-full bg-stone-50 border border-stone-200 text-stone-500 whitespace-nowrap">
                    {r}
                  </li>
                ))}
              </ul>
            )}

            {/* External link */}
            {event.url && (
              <div className="mt-3">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-medium text-stone-700 hover:text-stone-900 underline underline-offset-2 decoration-stone-300 whitespace-nowrap"
                >
                  View on {sourceLabel}
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 8l4-4M5 4h3v3" />
                  </svg>
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
