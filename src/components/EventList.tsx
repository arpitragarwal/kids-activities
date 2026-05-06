"use client";

import { useState, useRef, useEffect } from "react";
import { FilterBar, applyFilters } from "@/components/FilterBar";
import type { FilterId } from "@/components/FilterBar";
import dynamic from "next/dynamic";
import { EventCard } from "@/components/EventCard";
import type { RankedEvent } from "@/lib/rank";
import type { HourlyForecast } from "@/lib/weather";

// ─── Day weather helper ───────────────────────────────────────────────────

interface DayWeather {
  minF: number;
  maxF: number;
  precipPct: number;
  shortForecast: string;
}

function getDayWeather(periods: HourlyForecast[], startMs: number): DayWeather | null {
  const endMs = startMs + 24 * 60 * 60 * 1000;
  const day = periods.filter((p) => {
    const t = new Date(p.startTime).getTime();
    return t >= startMs && t < endMs;
  });
  if (day.length === 0) return null;
  const temps = day.map((p) => p.temperature);
  const daytime = day.filter((p) => p.isDaytime);
  const mid = daytime[Math.floor(daytime.length / 2)] ?? day[0];
  return {
    minF: Math.round(Math.min(...temps)),
    maxF: Math.round(Math.max(...temps)),
    precipPct: Math.max(...day.map((p) => p.probabilityOfPrecipitation)),
    shortForecast: mid.shortForecast,
  };
}

function dayWxIcon(precipPct: number, maxF: number): string {
  if (precipPct > 50) return "🌧️";
  if (maxF >= 75) return "🌤️";
  if (maxF >= 60) return "⛅";
  return "🌥️";
}

const MapView = dynamic(
  () => import("@/components/MapView").then((m) => ({ default: m.MapView })),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] bg-stone-50 border border-stone-200 rounded-xl mb-5 animate-pulse" />
    ),
  },
);

export interface DayData {
  label: string;       // "Wed May 1"
  abbr: string;        // "WE"
  num: number;         // 1
  isPast: boolean;
  startMs: number;     // Unix ms of Pacific midnight for this day
  topPicks: RankedEvent[];
  rest: RankedEvent[];
}

function MapIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M1 3l5 2 4-2 5 2v10l-5-2-4 2-5-2V3z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6 5v10M10 3v10" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M9 2.5L5 7l4 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M5 2.5L9 7l-4 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const WEEK_SIZE = 7;

// ─── Time filter ──────────────────────────────────────────────────────────

const TIME_OPTIONS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22];

function fmtHour(h: number): string {
  if (h === 12) return "12pm";
  if (h === 0 || h === 24) return "12am";
  return h > 12 ? `${h - 12}pm` : `${h}am`;
}

function getStartHourPacific(isoString: string): number {
  return parseInt(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Los_Angeles",
      hour: "numeric",
      hour12: false,
    }).format(new Date(isoString))
  );
}

function applyTimeFilter(
  events: RankedEvent[],
  after: number | null,
  before: number | null,
): RankedEvent[] {
  if (after === null && before === null) return events;
  return events.filter((e) => {
    if (e.evergreen) return true;
    const h = getStartHourPacific(e.start_at);
    if (after !== null && h < after) return false;
    if (before !== null && h >= before) return false;
    return true;
  });
}

function ChevronDown() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TimeDropdown({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: number | null;
  options: number[];
  onChange: (v: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const isActive = value !== null;

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
        {isActive ? fmtHour(value!) : <span className="text-stone-500">{label}</span>}
        <ChevronDown />
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 bg-white border border-stone-200 rounded-xl shadow-lg z-20 min-w-[100px] py-1 overflow-hidden max-h-52 overflow-y-auto">
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors ${
              value === null ? "bg-stone-50 font-semibold text-stone-900" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            Any
          </button>
          {options.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => { onChange(h); setOpen(false); }}
              className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors ${
                value === h ? "bg-stone-50 font-semibold text-stone-900" : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              {fmtHour(h)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EventList({
  days,
  initialActiveIdx = 0,
  periods,
  childAgeMonths,
  homeLat,
  homeLng,
}: {
  days: DayData[];
  initialActiveIdx?: number;
  periods: HourlyForecast[];
  childAgeMonths: number;
  homeLat: number;
  homeLng: number;
}) {
  const todayIdx = initialActiveIdx;
  const [activeIdx, setActiveIdx] = useState(initialActiveIdx);
  const [weekStart, setWeekStart] = useState(0);
  const [active, setActive] = useState(new Set<FilterId>());
  const [timeAfter, setTimeAfter] = useState<number | null>(null);
  const [timeBefore, setTimeBefore] = useState<number | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [page, setPage] = useState(1);

  function resetAllFilters() {
    setActive(new Set());
    setTimeAfter(null);
    setTimeBefore(null);
    setPage(1);
  }

  const PAGE_SIZE = 10;
  const maxWeekStart = Math.max(0, days.length - WEEK_SIZE);
  const visibleDays = days.slice(weekStart, weekStart + WEEK_SIZE);

  // Month label — handle weeks spanning two months
  const firstMonth = visibleDays[0]?.label.split(" ")[1] ?? "";
  const lastMonth = visibleDays[visibleDays.length - 1]?.label.split(" ")[1] ?? "";
  const monthLabel = firstMonth === lastMonth ? firstMonth : `${firstMonth} / ${lastMonth}`;

  function goPrevWeek() {
    const next = Math.max(0, weekStart - WEEK_SIZE);
    setWeekStart(next);
    setActiveIdx(next);
    resetAllFilters();
  }

  function goNextWeek() {
    const next = Math.min(weekStart + WEEK_SIZE, maxWeekStart);
    setWeekStart(next);
    setActiveIdx(next);
    resetAllFilters();
  }

  const day = days[activeIdx];
  const allEvents = [...day.topPicks, ...day.rest];
  const filteredTop = applyTimeFilter(applyFilters(day.topPicks, active), timeAfter, timeBefore);
  const filteredRest = applyTimeFilter(applyFilters(day.rest, active), timeAfter, timeBefore);
  const filteredAll = [...filteredTop, ...filteredRest];
  const totalPages = Math.max(1, Math.ceil(filteredAll.length / PAGE_SIZE));
  const pageItems = filteredAll.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pageTopPicks = pageItems.filter((e) => filteredTop.includes(e));
  const pageRest = pageItems.filter((e) => !filteredTop.includes(e));

  return (
    <>
      {/* Day strip */}
      <div className="mb-5 bg-white border border-stone-200 rounded-xl p-1.5">
        {/* Month row */}
        <div className="flex items-center justify-between px-0.5 pb-1">
          <button
            type="button"
            onClick={goPrevWeek}
            disabled={weekStart === 0}
            aria-label="Previous week"
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            <ChevronLeft />
          </button>
          <span className="text-[11.5px] font-semibold text-stone-500 tracking-wide">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={goNextWeek}
            disabled={weekStart >= maxWeekStart}
            aria-label="Next week"
            className="p-1.5 rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
          >
            <ChevronRight />
          </button>
        </div>

        {/* Day buttons */}
        <div className="grid grid-cols-7 gap-1">
          {visibleDays.map((d, i) => {
            const globalIdx = weekStart + i;
            const isActive = globalIdx === activeIdx;
            const hasEvents = d.topPicks.length + d.rest.length > 0;
            return (
              <button
                key={d.label}
                type="button"
                disabled={d.isPast}
                onClick={() => { setActiveIdx(globalIdx); resetAllFilters(); }}
                className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg transition-all duration-100 ${
                  d.isPast
                    ? "opacity-30 cursor-not-allowed text-stone-400"
                    : isActive
                    ? "bg-stone-900 text-white"
                    : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider leading-none">
                  {d.abbr}
                </span>
                <span className="text-[15px] font-semibold leading-none mt-0.5">
                  {d.num}
                </span>
                <span
                  className={`w-1.5 h-1.5 rounded-full mt-0.5 ${
                    hasEvents && !d.isPast
                      ? isActive ? "bg-white" : "bg-[#4a6fa5]"
                      : "opacity-0"
                  }`}
                />
              </button>
            );
          })}
        </div>
      </div>

      {/* Weather for selected day (future days only — today shown in header) */}
      {activeIdx !== todayIdx && (() => {
        const wx = getDayWeather(periods, days[activeIdx].startMs);
        if (!wx) return null;
        const icon = dayWxIcon(wx.precipPct, wx.maxF);
        return (
          <div className="flex items-center gap-2 text-[13px] mb-4 -mt-1">
            <span>{icon}</span>
            <span className="font-medium text-stone-700">{wx.minF}°–{wx.maxF}°</span>
            <span className="text-stone-400">· {wx.shortForecast}</span>
            {wx.precipPct >= 30 && (
              <span className="text-stone-400">· {wx.precipPct}% rain</span>
            )}
          </div>
        );
      })()}

      {/* Filter bar + map toggle */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
        <FilterBar allEvents={allEvents} active={active} onChange={(v) => { setActive(v); setPage(1); }} />
        <TimeDropdown
          label="After"
          value={timeAfter}
          options={TIME_OPTIONS.slice(0, -1)}
          onChange={(v) => { setTimeAfter(v); setPage(1); }}
        />
        <TimeDropdown
          label="Before"
          value={timeBefore}
          options={TIME_OPTIONS.slice(1)}
          onChange={(v) => { setTimeBefore(v); setPage(1); }}
        />
        {(active.size > 0 || timeAfter !== null || timeBefore !== null) && (
          <button
            type="button"
            onClick={resetAllFilters}
            className="text-[11.5px] text-stone-400 hover:text-stone-600 px-2 py-1 transition-colors"
          >
            Clear ×
          </button>
        )}
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => setShowMap((v) => !v)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[12.5px] font-medium transition-all duration-100 ${
              showMap
                ? "bg-stone-900 border-stone-900 text-white"
                : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"
            }`}
          >
            <MapIcon />
            Map
          </button>
        </div>
      </div>

      {/* Map */}
      {showMap && (
        <MapView events={filteredAll} homeLat={homeLat} homeLng={homeLng} />
      )}

      {/* Top picks (page 1 only) */}
      {page === 1 && pageTopPicks.length > 0 && (
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
            {pageTopPicks.map((e) => (
              <EventCard key={`${e.source_id}-${e.external_id}`} event={e} childAgeMonths={childAgeMonths} />
            ))}
          </div>
        </section>
      )}

      {/* Everything else */}
      <section>
        {pageRest.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400">
                {page === 1
                  ? `Everything available ${activeIdx === todayIdx ? "today" : day.label.split(" ").slice(0, 2).join(" ")}`
                  : `More activities`}
              </h2>
              <span className="text-[11px] font-mono text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                {filteredAll.length}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {pageRest.map((e) => (
                <EventCard key={`${e.source_id}-${e.external_id}`} event={e} childAgeMonths={childAgeMonths} />
              ))}
            </div>
          </>
        )}

        {filteredAll.length === 0 && active.size > 0 && (
          <p className="text-sm text-stone-400 py-2">No events match the active filters.</p>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-stone-100">
            <button
              type="button"
              onClick={() => { setPage((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-[13px] text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <span className="text-[12px] text-stone-400">
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredAll.length)} of {filteredAll.length}
            </span>
            <button
              type="button"
              onClick={() => { setPage((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-stone-200 text-[13px] text-stone-500 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </>
  );
}
