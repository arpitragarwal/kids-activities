"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";
import type { RankedEvent } from "@/lib/rank";

const PIN_COLOR: Record<string, string> = {
  indoor:  "#2e78b8",
  outdoor: "#3d7c52",
  either:  "#c9893a",
};

function pinIcon(L: typeof import("leaflet"), color: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
    <path d="M11 0C4.9 0 0 4.9 0 11c0 8.3 11 19 11 19S22 19.3 22 11C22 4.9 17.1 0 11 0z"
      fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="11" cy="11" r="3.5" fill="white" opacity="0.9"/>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [22, 30], iconAnchor: [11, 30], popupAnchor: [0, -32] });
}

function homeIcon(L: typeof import("leaflet")) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
    <circle cx="14" cy="14" r="13" fill="#4a6fa5" stroke="white" stroke-width="2"/>
    <text x="14" y="19" text-anchor="middle" fill="white" font-size="13" font-family="sans-serif">⌂</text>
  </svg>`;
  return L.divIcon({ html: svg, className: "", iconSize: [28, 28], iconAnchor: [14, 14] });
}

export function MapView({
  events,
  homeLat,
  homeLng,
}: {
  events: RankedEvent[];
  homeLat: number;
  homeLng: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    import("leaflet").then((mod) => {
      if (cancelled || !containerRef.current) return;
      const L = mod.default;

      // Tear down any previous instance
      mapRef.current?.remove();

      const map = L.map(containerRef.current, {
        center: [homeLat, homeLng],
        zoom: 13,
        zoomControl: true,
      });

      L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map);

      L.marker([homeLat, homeLng], { icon: homeIcon(L) }).addTo(map);

      const seen = new Set<string>();
      for (const e of events) {
        if (e.lat == null || e.lng == null) continue;
        const key = `${e.lat.toFixed(4)},${e.lng.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        L.marker([e.lat, e.lng], { icon: pinIcon(L, PIN_COLOR[e.indoorness] ?? "#666") })
          .bindPopup(`<strong style="font-size:13px">${e.title}</strong>`)
          .addTo(map);
      }

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [homeLat, homeLng, events]);

  const pinCount = events.filter((e) => e.lat != null && e.lng != null).length;

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden shadow-sm mb-5">
      <div ref={containerRef} style={{ height: 280 }} />
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
          {pinCount} location{pinCount !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}
