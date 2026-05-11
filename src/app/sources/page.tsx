import { formatDistanceToNow } from "date-fns";
import { getSourceHealth } from "@/lib/sources";
import { getCachedWeather } from "@/lib/weather";
import type { SourceHealth } from "@/lib/types";

export const dynamic = "force-dynamic";

// ─── City/region groupings ────────────────────────────────────────────────

const GROUPS = [
  {
    label: "Mountain View",
    ids: ["cityRec", "library", "parks", "musicTogether", "mvPool", "eaglePool"],
  },
  {
    label: "Sunnyvale",
    ids: ["sunnyvaleRec", "sunnyvaleLibrary"],
  },
  {
    label: "Santa Clara",
    ids: ["santaClaraRec", "santaClaraLibrary", "santaClaraGomezPool", "santaClaraWarburtonPool"],
  },
  {
    label: "Cupertino",
    ids: ["cupertinoRec", "scclLibrary", "cupertinoBlackberryPool"],
  },
  {
    label: "San Jose",
    ids: ["sanJoseRec", "sanJoseLibrary"],
  },
  {
    label: "Milpitas",
    ids: ["milpitasRec"],
  },
  {
    label: "Los Gatos & Campbell",
    ids: ["losGatosLibrary", "campbellPool"],
  },
  {
    label: "Fremont & East Bay",
    ids: ["fremontRec", "alamedaCountyLibrary"],
  },
  {
    label: "Daly City & San Francisco",
    ids: ["dalyCityRec", "dalyCityPool", "sfRec"],
  },
  {
    label: "Palo Alto & Redwood City",
    ids: ["paloAltoLibrary", "redwoodCityRec"],
  },
  {
    label: "San Mateo",
    ids: ["sanMateoPublicLibraryKids", "sanMateoPublicLibrary", "sanMateoCountyLibrary", "sanMateoJoinvillePool", "sanMateoKingPool"],
  },
];

// Tile labels show source type — city is already the section heading.
const SHORT_NAME: Record<string, string> = {
  // Mountain View
  cityRec:                    "Recreation",
  library:                    "Public Library",
  parks:                      "Parks & Places",
  musicTogether:              "Music Together",
  mvPool:                     "Rengstorff Pool",
  eaglePool:                  "Eagle Park Pool",
  // Sunnyvale
  sunnyvaleRec:               "Recreation",
  sunnyvaleLibrary:           "Public Library",
  // Santa Clara
  santaClaraRec:              "Recreation",
  santaClaraLibrary:          "City Library",
  santaClaraGomezPool:        "Mary Gomez Pool",
  santaClaraWarburtonPool:    "Warburton Pool",
  // Cupertino (scclLibrary also covers Los Altos, Milpitas, Campbell branches)
  cupertinoRec:               "Recreation",
  scclLibrary:                "County Library",
  cupertinoBlackberryPool:    "Blackberry Farm Pool",
  // San Jose
  sanJoseRec:                 "Recreation",
  sanJoseLibrary:             "Public Library",
  // Milpitas
  milpitasRec:                "Recreation",
  // Los Gatos & Campbell
  losGatosLibrary:            "Los Gatos Library",
  campbellPool:               "Community Pool",
  // Fremont & East Bay
  fremontRec:                 "Fremont Recreation",
  alamedaCountyLibrary:       "Alameda Co. Library",
  // Daly City & San Francisco
  dalyCityRec:                "Daly City Recreation",
  dalyCityPool:               "Giammona Pool",
  sfRec:                      "SF Rec & Parks",
  // Palo Alto & Redwood City
  paloAltoLibrary:            "Palo Alto Library",
  redwoodCityRec:             "Redwood City Rec",
  // San Mateo
  sanMateoPublicLibraryKids:  "Public Library (Kids)",
  sanMateoPublicLibrary:      "Public Library",
  sanMateoCountyLibrary:      "County Library",
  sanMateoJoinvillePool:      "Joinville Pool",
  sanMateoKingPool:           "King Pool",
};

// ─── Status styles ────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  ok:        "bg-emerald-500",
  stale:     "bg-amber-400",
  broken:    "bg-red-500",
  never_run: "bg-stone-300",
};

const STATUS_BORDER: Record<string, string> = {
  ok:        "border-emerald-200",
  stale:     "border-amber-200",
  broken:    "border-red-200",
  never_run: "border-stone-200",
};

const STATUS_LABEL: Record<string, string> = {
  ok:        "ok",
  stale:     "stale",
  broken:    "broken",
  never_run: "never run",
};

// ─── Tile ─────────────────────────────────────────────────────────────────

function SourceTile({ h }: { h: SourceHealth }) {
  const ago = h.lastSuccessAt
    ? formatDistanceToNow(h.lastSuccessAt, { addSuffix: false })
        .replace(" minutes", "m").replace(" minute", "m")
        .replace(" hours", "h").replace(" hour", "h")
        .replace(" days", "d").replace(" day", "d")
        .replace("about ", "").replace("less than a", "<1")
    : null;

  return (
    <div className={`relative bg-white border rounded-xl p-3 flex flex-col gap-2 ${STATUS_BORDER[h.status]}`}>
      {/* Status dot + name */}
      <div className="flex items-start justify-between gap-1">
        <span className="text-[12.5px] font-semibold text-stone-800 leading-tight">
          {SHORT_NAME[h.id] ?? h.name}
        </span>
        <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[h.status]}`} />
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-2 text-[11px] text-stone-400">
        {h.lastEventCount !== null && (
          <span className="font-mono font-medium text-stone-600">
            {h.lastEventCount}
            <span className="font-sans font-normal text-stone-400"> events</span>
          </span>
        )}
        {ago && (
          <span className="ml-auto">{ago} ago</span>
        )}
        {!h.lastSuccessAt && (
          <span className="text-stone-400 italic">never run</span>
        )}
      </div>

      {/* Error */}
      {h.lastError && (
        <p className="text-[10.5px] font-mono text-red-600 bg-red-50 rounded px-2 py-1 leading-snug line-clamp-2">
          {h.lastError}
        </p>
      )}

      {/* Refresh */}
      <form action={`/api/refresh-one?id=${h.id}`} method="post" className="mt-auto pt-1 border-t border-stone-100">
        <button
          type="submit"
          className="text-[11px] text-stone-400 hover:text-stone-700 transition-colors"
        >
          Refresh ↻
        </button>
      </form>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────

export default async function HealthPage() {
  const [health, { fetchedAt }] = await Promise.all([
    getSourceHealth(),
    getCachedWeather(),
  ]);

  const byId = new Map(health.map((h) => [h.id, h]));
  const okCount = health.filter((h) => h.status === "ok").length;
  const brokenCount = health.filter((h) => h.status === "broken").length;
  const neverCount = health.filter((h) => h.status === "never_run").length;

  return (
    <main>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[15px] font-semibold">
            Source health
            <span className="ml-2 font-mono text-[12px] font-normal text-stone-400">{health.length} sources</span>
          </h1>
          <div className="flex items-center gap-2 mt-1 text-[12px]">
            <span className="text-emerald-600">{okCount} ok</span>
            {brokenCount > 0 && <span className="text-red-500">{brokenCount} broken</span>}
            {neverCount > 0 && <span className="text-stone-400">{neverCount} never run</span>}
            <span className="text-stone-300">·</span>
            <span className="text-stone-400">Refreshes hourly</span>
          </div>
        </div>
        <form action="/api/refresh" method="post">
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-[12.5px] font-medium hover:bg-stone-700 transition-colors"
          >
            Refresh all
          </button>
        </form>
      </div>

      <div className="space-y-6">
        {GROUPS.map((group) => {
          const sources = group.ids.map((id) => byId.get(id)).filter(Boolean) as SourceHealth[];
          if (sources.length === 0) return null;
          return (
            <section key={group.label}>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
                {group.label}
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {sources.map((h) => (
                  <SourceTile key={h.id} h={h} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Any sources not in a group */}
        {(() => {
          const grouped = new Set(GROUPS.flatMap((g) => g.ids));
          const ungrouped = health.filter((h) => !grouped.has(h.id));
          if (ungrouped.length === 0) return null;
          return (
            <section>
              <h2 className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
                Other
              </h2>
              <div className="grid grid-cols-3 gap-2">
                {ungrouped.map((h) => <SourceTile key={h.id} h={h} />)}
              </div>
            </section>
          );
        })()}
      </div>

      {/* Weather cache */}
      <div className="mt-6 flex items-center justify-between bg-white border border-stone-200 rounded-xl px-3.5 py-3">
        <div>
          <span className="text-[12.5px] font-semibold text-stone-700">Weather cache</span>
          <span className="text-[11px] text-stone-400 ml-2">
            {fetchedAt
              ? `${formatDistanceToNow(fetchedAt)} ago`
              : "never fetched"}
          </span>
        </div>
        <span className={`w-2 h-2 rounded-full ${fetchedAt ? "bg-emerald-500" : "bg-stone-300"}`} />
      </div>
    </main>
  );
}
