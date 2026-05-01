"use client";

import { useState } from "react";
import type { RankedEvent } from "@/lib/rank";

// ─── Projection ───────────────────────────────────────────────────────────
// Bounding box covers Mountain View / surrounding area.

const BOUNDS = {
  minLat: 37.360, maxLat: 37.410,
  minLng: -122.110, maxLng: -122.065,
};
const W = 640, H = 220;

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * W;
  const y = H - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat)) * H;
  return { x, y };
}

// ─── Colors ───────────────────────────────────────────────────────────────

const PIN_COLOR: Record<string, string> = {
  indoor:  "#2e78b8",
  outdoor: "#3d7c52",
  either:  "#c9893a",
};

// ─── MapView ──────────────────────────────────────────────────────────────

export function MapView({
  events,
  homeLat,
  homeLng,
}: {
  events: RankedEvent[];
  homeLat: number;
  homeLng: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const homePos = project(homeLat, homeLng);

  // Dedupe pins by lat/lng bucket to avoid stacked markers.
  const seen = new Set<string>();
  const pins = events
    .filter((e) => e.lat !== null && e.lng !== null)
    .filter((e) => {
      const key = `${e.lat!.toFixed(4)},${e.lng!.toFixed(4)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm mb-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", width: "100%" }}
      >
        {/* Background */}
        <rect width={W} height={H} fill="#f0ede8" />

        {/* Grid lines */}
        {[0.2, 0.4, 0.6, 0.8].map((t) => (
          <g key={t}>
            <line x1={W * t} y1={0} x2={W * t} y2={H} stroke="#e0dbd3" strokeWidth="1" />
            <line x1={0} y1={H * t} x2={W} y2={H * t} stroke="#e0dbd3" strokeWidth="1" />
          </g>
        ))}

        {/* Block shapes for street texture */}
        {[0.1, 0.3, 0.5, 0.7, 0.9].flatMap((tx) =>
          [0.15, 0.35, 0.55, 0.75].map((ty) => (
            <rect
              key={`${tx}-${ty}`}
              x={W * tx - 18} y={H * ty - 10} width={36} height={20}
              rx={3} fill="#e8e3dc" opacity="0.5"
            />
          ))
        )}

        {/* Distance radius from home */}
        <circle
          cx={homePos.x} cy={homePos.y} r={H * 0.35}
          fill="none" stroke="#4a6fa5" strokeWidth="1"
          strokeDasharray="4 4" opacity="0.25"
        />

        {/* Event pins */}
        {pins.map((e) => {
          const pos = project(e.lat!, e.lng!);
          const key = `${e.source_id}:${e.external_id}`;
          const color = PIN_COLOR[e.indoorness] ?? "#666";
          const isHovered = hovered === key;
          const scale = isHovered ? 1.15 : 1;

          return (
            <g
              key={key}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              {/* Drop shadow */}
              <ellipse cx={pos.x} cy={pos.y + 14} rx={5} ry={2.5} fill="rgba(0,0,0,0.15)" />
              {/* Pin body */}
              <path
                d={`M${pos.x},${pos.y + 14} C${pos.x - 8},${pos.y + 6} ${pos.x - 8},${pos.y - 8} ${pos.x},${pos.y - 8} C${pos.x + 8},${pos.y - 8} ${pos.x + 8},${pos.y + 6} ${pos.x},${pos.y + 14}z`}
                fill={color}
                stroke="white"
                strokeWidth={isHovered ? 2.5 : 1.5}
                transform={`translate(${pos.x},${pos.y - 2}) scale(${scale}) translate(${-pos.x},${-(pos.y - 2)})`}
                style={{ transition: "transform 0.15s ease" }}
              />
              {/* Pin dot */}
              <circle cx={pos.x} cy={pos.y - 2} r={2.5} fill="white" opacity="0.9" />

              {/* Hover tooltip */}
              {isHovered && (() => {
                const tipX = Math.min(Math.max(pos.x - 60, 4), W - 124);
                const tipY = pos.y - 42;
                const label = e.title.length > 18 ? e.title.slice(0, 17) + "…" : e.title;
                return (
                  <g>
                    <rect x={tipX} y={tipY} width={120} height={26} rx={5} fill="rgba(28,25,23,0.88)" />
                    <text
                      x={tipX + 60} y={tipY + 17}
                      textAnchor="middle"
                      fill="white"
                      fontSize="10.5"
                      fontFamily="DM Sans, ui-sans-serif, sans-serif"
                      fontWeight="500"
                    >
                      {label}
                    </text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Home marker */}
        <circle cx={homePos.x} cy={homePos.y} r={10} fill="#4a6fa5" stroke="white" strokeWidth={2} />
        <text
          x={homePos.x} y={homePos.y + 4.5}
          textAnchor="middle"
          fill="white"
          fontSize="9"
          fontFamily="DM Sans, ui-sans-serif, sans-serif"
          fontWeight="600"
        >
          ⌂
        </text>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-3.5 py-2 border-t border-stone-100 bg-stone-50">
        {[
          { color: "#4a6fa5", label: "Home" },
          { color: "#2e78b8", label: "Indoor" },
          { color: "#3d7c52", label: "Outdoor" },
          { color: "#c9893a", label: "In/Out" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-stone-500">
            <svg width="8" height="8"><circle cx="4" cy="4" r="4" fill={color} /></svg>
            {label}
          </div>
        ))}
        <span className="ml-auto text-[11px] text-stone-400">
          {pins.length} location{pins.length !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
