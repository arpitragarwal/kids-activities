"use client";

import { useRef, useState, useEffect } from "react";
import type { RankedEvent } from "@/lib/rank";

// ─── Time helper ─────────────────────────────────────────────────────────

function startHourPacific(isoString: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date(isoString))
  );
}

// ─── Filter model ─────────────────────────────────────────────────────────

export type FilterId =
  | "indoor" | "outdoor"
  | "free" | "paid"
  | "dropin" | "preregistration"
  | "morning" | "midmorning" | "afternoon" | "lateafternoon" | "evening"
  | "walk" | "near" | "mid" | "far";

interface FilterOption {
  id: FilterId | null; // null = "Any"
  label: string;
  test: (e: RankedEvent) => boolean;
}

interface FilterGroup {
  key: string;
  label: string;
  memberIds: FilterId[];
  options: FilterOption[];
}

const GROUPS: FilterGroup[] = [
  {
    key: "location",
    label: "Location",
    memberIds: ["indoor", "outdoor"],
    options: [
      { id: null,      label: "Any",     test: () => true },
      { id: "indoor",  label: "Indoor",  test: (e) => e.indoorness === "indoor" },
      { id: "outdoor", label: "Outdoor", test: (e) => e.indoorness === "outdoor" },
    ],
  },
  {
    key: "cost",
    label: "Cost",
    memberIds: ["free", "paid"],
    options: [
      { id: null,   label: "Any",  test: () => true },
      { id: "free", label: "Free", test: (e) => /^free$/i.test(e.cost) },
      { id: "paid", label: "Paid", test: (e) => !/^free$/i.test(e.cost) },
    ],
  },
  {
    key: "registration",
    label: "Sign-up",
    memberIds: ["dropin", "preregistration"],
    options: [
      { id: null,               label: "Any",       test: () => true },
      { id: "dropin",           label: "Drop-in",   test: (e) => e.registration === "drop-in" || e.registration === "walk-in" },
      { id: "preregistration",  label: "Required",  test: (e) => e.registration === "required" },
    ],
  },
  {
    key: "time",
    label: "Time",
    memberIds: ["morning", "midmorning", "afternoon", "lateafternoon", "evening"],
    options: [
      { id: null,            label: "Any time",  test: () => true },
      { id: "morning",       label: "6–9am",     test: (e) => { if (e.evergreen) return true; const h = startHourPacific(e.start_at); return h >= 6 && h < 9; } },
      { id: "midmorning",    label: "9am–Noon",  test: (e) => { if (e.evergreen) return true; const h = startHourPacific(e.start_at); return h >= 9 && h < 12; } },
      { id: "afternoon",     label: "Noon–3pm",  test: (e) => { if (e.evergreen) return true; const h = startHourPacific(e.start_at); return h >= 12 && h < 15; } },
      { id: "lateafternoon", label: "3–6pm",     test: (e) => { if (e.evergreen) return true; const h = startHourPacific(e.start_at); return h >= 15 && h < 18; } },
      { id: "evening",       label: "6pm+",      test: (e) => { if (e.evergreen) return true; const h = startHourPacific(e.start_at); return h >= 18; } },
    ],
  },
  {
    key: "distance",
    label: "Distance",
    memberIds: ["walk", "near", "mid", "far"],
    options: [
      { id: null,   label: "Any distance", test: () => true },
      { id: "walk", label: "Walking",      test: (e) => e.distanceMiles === null || e.distanceMiles <= 1 },
      { id: "near", label: "Within 5mi",   test: (e) => e.distanceMiles === null || e.distanceMiles <= 5 },
      { id: "mid",  label: "Within 10mi",  test: (e) => e.distanceMiles === null || e.distanceMiles <= 10 },
      { id: "far",  label: ">10mi",        test: (e) => e.distanceMiles !== null && e.distanceMiles > 10 },
    ],
  },
];

const ALL_OPTIONS = GROUPS.flatMap((g) =>
  g.options.filter((o) => o.id !== null)
) as (FilterOption & { id: FilterId })[];

// ─── Utility ──────────────────────────────────────────────────────────────

export function applyFilters(events: RankedEvent[], active: Set<FilterId>): RankedEvent[] {
  if (active.size === 0) return events;
  return events.filter((e) =>
    [...active].every((id) => {
      const f = ALL_OPTIONS.find((x) => x.id === id);
      return f ? f.test(e) : true;
    })
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FilterDropdown({
  group,
  active,
  allEvents,
  onChange,
}: {
  group: FilterGroup;
  active: Set<FilterId>;
  allEvents: RankedEvent[];
  onChange: (next: Set<FilterId>) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activeId = group.memberIds.find((id) => active.has(id)) ?? null;
  const activeLabel = group.options.find((o) => o.id === activeId)?.label;
  const isActive = activeId !== null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function select(id: FilterId | null) {
    const next = new Set(active);
    for (const mid of group.memberIds) next.delete(mid);
    if (id) next.add(id);
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12.5px] font-medium transition-all duration-100 ${
          isActive
            ? "bg-stone-900 border-stone-900 text-white"
            : open
            ? "bg-stone-50 border-stone-400 text-stone-700"
            : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"
        }`}
      >
        {isActive ? activeLabel : <span className="text-stone-500">{group.label}</span>}
        <ChevronDown />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 bg-white border border-stone-200 rounded-xl shadow-lg z-20 min-w-[130px] py-1 overflow-hidden">
          {group.options.map((opt) => {
            const count = opt.id
              ? allEvents.filter((e) => opt.test(e)).length
              : allEvents.length;
            const isSelected = opt.id === activeId;
            return (
              <button
                key={opt.id ?? "any"}
                type="button"
                onClick={() => select(opt.id)}
                className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center justify-between gap-4 transition-colors ${
                  isSelected
                    ? "bg-stone-50 font-semibold text-stone-900"
                    : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                <span>{opt.label}</span>
                <span className="text-[11px] font-mono text-stone-400 tabular-nums">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── FilterBar ────────────────────────────────────────────────────────────

export function FilterBar({
  allEvents,
  active,
  onChange,
}: {
  allEvents: RankedEvent[];
  active: Set<FilterId>;
  onChange: (next: Set<FilterId>) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {GROUPS.map((group) => (
        <FilterDropdown
          key={group.key}
          group={group}
          active={active}
          allEvents={allEvents}
          onChange={onChange}
        />
      ))}

    </div>
  );
}
