"use client";

import { useState } from "react";
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

function wxIcon(forecast: string, precipPct: number): string {
  const f = forecast.toLowerCase();
  if (precipPct > 50 || f.includes("rain") || f.includes("shower") || f.includes("storm")) return "🌧";
  if (precipPct > 20 || f.includes("drizzle")) return "🌦";
  if (f.includes("snow")) return "❄️";
  if (f.includes("fog") || f.includes("mist")) return "🌫";
  if (f.includes("mostly sunny") || f.includes("mostly clear")) return "🌤";
  if (f.includes("partly") || f.includes("partly cloudy")) return "⛅";
  if (f.includes("cloudy") || f.includes("overcast")) return "☁️";
  if (f.includes("sunny") || f.includes("clear")) return "☀️";
  return "🌤";
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
  const [active, setActive] = useState(new Set<FilterId>(["dropin", "mid"]));
  const [showMap, setShowMap] = useState(false);
  const [page, setPage] = useState(1);

  function resetAllFilters() {
    setActive(new Set());
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
    setPage(1);
  }

  function goNextWeek() {
    const next = Math.min(weekStart + WEEK_SIZE, maxWeekStart);
    setWeekStart(next);
    setActiveIdx(next);
    setPage(1);
  }

  const day = days[activeIdx];
  const allEvents = [...day.topPicks, ...day.rest];
  const filteredTop = applyFilters(day.topPicks, active);
  const filteredRest = applyFilters(day.rest, active);
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
            const wx = getDayWeather(periods, d.startMs);
            return (
              <button
                key={d.label}
                type="button"
                disabled={d.isPast}
                onClick={() => { setActiveIdx(globalIdx); setPage(1); }}
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
                {wx ? (
                  <>
                    <span className="text-[11px] leading-none mt-0.5" style={{ fontFamily: "Apple Color Emoji, Segoe UI Emoji, sans-serif" }}>
                      {wxIcon(wx.shortForecast, wx.precipPct)}
                    </span>
                    <span className="text-[9px] tabular-nums leading-none opacity-70">
                      {wx.minF}–{wx.maxF}°
                    </span>
                  </>
                ) : (
                  <span className="text-[9px] leading-none mt-0.5 opacity-0">–</span>
                )}
              </button>
            );
          })}
        </div>
      </div>


      {/* Filter bar + map toggle */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        <FilterBar allEvents={allEvents} active={active} onChange={(v) => { setActive(v); setPage(1); }} />
        {active.size > 0 && (
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
        <section className="mb-7">
          <div className="flex items-baseline justify-between mb-3 gap-3">
            <h2 className="text-[15px] font-semibold tracking-tight text-stone-900 flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className="text-amber-500 shrink-0">
                <path d="M8 1l1.8 3.6L14 5.4l-3 2.9.7 4.1L8 10.4l-3.7 2 .7-4.1-3-2.9 4.2-.8z" />
              </svg>
              {childAgeMonths
                ? `Picked for your ${Math.floor(childAgeMonths / 12) > 0
                    ? `${Math.floor(childAgeMonths / 12)}y${childAgeMonths % 12 > 0 ? ` ${childAgeMonths % 12}m` : ""}`
                    : `${childAgeMonths}m`}-old`
                : "Top picks"}
            </h2>
            <span className="text-[11px] text-stone-400 whitespace-nowrap shrink-0">
              {pageTopPicks.length} {pageTopPicks.length === 1 ? "pick" : "picks"}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {pageTopPicks.map((e, i) => (
              <EventCard
                key={`${e.source_id}-${e.external_id}`}
                event={e}
                childAgeMonths={childAgeMonths}
                isTopPick
                defaultExpanded={i === 0 && page === 1}
              />
            ))}
          </div>
        </section>
      )}

      {/* Everything else */}
      <section>
        {pageRest.length > 0 && (
          <>
            <div className="flex items-baseline justify-between mb-3 gap-3">
              <h2 className="text-[11px] font-semibold uppercase tracking-widest text-stone-400 whitespace-nowrap">
                {page === 1
                  ? `Everything else ${activeIdx === todayIdx ? "today" : day.label.split(" ").slice(0, 2).join(" ")}`
                  : "More activities"}
              </h2>
              <span className="text-[11px] text-stone-400 tabular-nums whitespace-nowrap shrink-0">
                {filteredAll.length} matching
              </span>
            </div>
            <div className="flex flex-col gap-2">
              {pageRest.map((e) => (
                <EventCard key={`${e.source_id}-${e.external_id}`} event={e} childAgeMonths={childAgeMonths} />
              ))}
            </div>
          </>
        )}

        {filteredAll.length === 0 && (
          <div className="text-center py-10 px-6 border border-dashed border-stone-300 rounded-xl bg-white">
            <p className="text-stone-600 font-medium text-sm">No matches with these filters.</p>
            <p className="text-stone-400 text-[12.5px] mt-1">Try removing one or two to see more.</p>
          </div>
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
