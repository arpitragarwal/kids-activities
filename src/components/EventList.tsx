"use client";

import { useState } from "react";
import { FilterBar, applyFilters } from "@/components/FilterBar";
import type { FilterId } from "@/components/FilterBar";
import { EventCard } from "@/components/EventCard";
import { MapView } from "@/components/MapView";
import type { RankedEvent } from "@/lib/rank";

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 3l5 2 4-2 5 2v10l-5-2-4 2-5-2V3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 5v10M10 3v10" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function EventList({
  topPicks,
  rest,
  childAgeMonths,
  homeLat,
  homeLng,
}: {
  topPicks: RankedEvent[];
  rest: RankedEvent[];
  childAgeMonths: number;
  homeLat: number;
  homeLng: number;
}) {
  const [active, setActive] = useState(new Set<FilterId>());
  const [showMap, setShowMap] = useState(false);

  const allEvents = [...topPicks, ...rest];
  const filteredTop = applyFilters(topPicks, active);
  const filteredRest = applyFilters(rest, active);
  const filteredAll = applyFilters(allEvents, active);

  return (
    <>
      {/* Filter bar + map toggle */}
      <div className="flex items-start gap-2 mb-5">
        <div className="flex-1">
          <FilterBar allEvents={allEvents} active={active} onChange={setActive} />
        </div>
        <button
          type="button"
          onClick={() => setShowMap((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12.5px] font-medium transition-all duration-100 shrink-0 ${
            showMap
              ? "bg-stone-900 border-stone-900 text-white"
              : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"
          }`}
        >
          <MapIcon />
          Map
        </button>
      </div>

      {/* Map */}
      {showMap && (
        <MapView events={filteredAll} homeLat={homeLat} homeLng={homeLng} />
      )}

      {/* Top picks */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 rounded-full px-2.5 py-1">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1l1.8 3.6L14 5.4l-3 2.9.7 4.1L8 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z" />
            </svg>
            Top picks
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {filteredTop.map((e) => (
            <EventCard
              key={`${e.source_id}-${e.external_id}`}
              event={e}
              childAgeMonths={childAgeMonths}
            />
          ))}
          {filteredTop.length === 0 && active.size > 0 && (
            <p className="text-sm text-stone-400 py-2">No top picks match the active filters.</p>
          )}
        </div>
      </section>

      {/* Everything else */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
            Everything available today
          </h2>
          <span className="text-[11px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
            {filteredRest.length}
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          {filteredRest.map((e) => (
            <EventCard
              key={`${e.source_id}-${e.external_id}`}
              event={e}
              childAgeMonths={childAgeMonths}
            />
          ))}
          {filteredRest.length === 0 && active.size > 0 && (
            <p className="text-sm text-stone-400 py-2">No events match the active filters.</p>
          )}
        </div>
      </section>
    </>
  );
}
