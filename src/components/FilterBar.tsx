"use client";

import { useState, useTransition } from "react";
import type { RankedEvent } from "@/lib/rank";

// ─── Filter definitions ───────────────────────────────────────────────────

export type FilterId = "indoor" | "outdoor" | "free" | "dropin";

interface FilterDef {
  id: FilterId;
  label: string;
  dotClass: string;
  test: (e: RankedEvent) => boolean;
}

const FILTERS: FilterDef[] = [
  {
    id: "indoor",
    label: "Indoor",
    dotClass: "bg-sky-400",
    test: (e) => e.indoorness === "indoor",
  },
  {
    id: "outdoor",
    label: "Outdoor",
    dotClass: "bg-emerald-500",
    test: (e) => e.indoorness === "outdoor",
  },
  {
    id: "free",
    label: "Free",
    dotClass: "bg-emerald-400",
    test: (e) => /^free$/i.test(e.cost),
  },
  {
    id: "dropin",
    label: "Drop-in",
    dotClass: "bg-sky-400",
    test: (e) => e.registration === "drop-in" || e.registration === "walk-in",
  },
];

// ─── Utility ──────────────────────────────────────────────────────────────

/** Apply a set of active filter IDs to an event list (AND logic). */
export function applyFilters(
  events: RankedEvent[],
  active: Set<FilterId>,
): RankedEvent[] {
  if (active.size === 0) return events;
  return events.filter((e) =>
    [...active].every((id) => {
      const f = FILTERS.find((x) => x.id === id);
      return f ? f.test(e) : true;
    }),
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export function FilterBar({
  allEvents,
  active,
  onChange,
}: {
  /** Full unfiltered list — used for per-chip counts. */
  allEvents: RankedEvent[];
  active: Set<FilterId>;
  onChange: (next: Set<FilterId>) => void;
}) {
  function toggle(id: FilterId) {
    const next = new Set(active);
    next.has(id) ? next.delete(id) : next.add(id);
    onChange(next);
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400 mr-0.5">
        Filter
      </span>

      {FILTERS.map((f) => {
        const count = allEvents.filter(f.test).length;
        const isActive = active.has(f.id);
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => toggle(f.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12.5px] font-medium transition-all duration-100 ${
              isActive
                ? "bg-stone-900 border-stone-900 text-white"
                : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"
            }`}
          >
            {!isActive && (
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.dotClass}`} />
            )}
            {f.label}
            <span className={`text-[10px] font-mono ${isActive ? "opacity-60" : "opacity-50"}`}>
              {count}
            </span>
          </button>
        );
      })}

      {active.size > 0 && (
        <button
          type="button"
          onClick={() => onChange(new Set())}
          className="text-[11.5px] text-stone-400 hover:text-stone-600 px-2 py-1 transition-colors"
        >
          Clear ×
        </button>
      )}
    </div>
  );
}
