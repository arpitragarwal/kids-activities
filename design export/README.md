# MV Kids — Design Handoff

These files are drop-in replacements for the corresponding files in your Next.js codebase.
Copy each file to the path shown below, relative to your project root.

---

## Files changed

| File in this folder | Replaces |
|---|---|
| `src/app/layout.tsx` | `src/app/layout.tsx` |
| `src/app/globals.css` | `src/app/globals.css` |
| `src/app/page.tsx` | `src/app/page.tsx` |
| `src/components/EventCard.tsx` | `src/components/EventCard.tsx` |
| `src/components/ContextHeader.tsx` | *(new file — replaces WeatherBanner.tsx + SettingsBar.tsx)* |
| `src/components/FilterBar.tsx` | *(new file)* |

You can **delete** `src/components/WeatherBanner.tsx` and `src/components/SettingsBar.tsx`
after copying — they are superseded by `ContextHeader.tsx`.

---

## What changed and why

### `ContextHeader.tsx` (new)
Merges the old `WeatherBanner`, `SettingsBar`, and date-strip into one unified
**Split Header** component:

- **Left:** Date headline + weather icon/temp/condition + colored advice pill
- **Right:** Age chip + address chip (shows "Street, City") + "Edit profile" toggle
- **Drawer:** Clicking "Edit profile" expands an inline form (same POST `/api/settings`
  action as before — no API changes needed)

Props:
```ts
<ContextHeader
  periods={periods}       // HourlyForecast[] from getCachedWeather()
  fetchedAt={fetchedAt}   // Date | null
  cfg={cfg}               // EffectiveConfig from getEffectiveConfig()
  status={params.status}  // from searchParams (save confirmation)
  error={params.error}    // from searchParams (error message)
/>
```

### `EventCard.tsx`
Three visual changes:
1. **Left accent bar** — 3px colored stripe: blue (indoor), green (outdoor), amber (in/out)
2. **Age-fit dot** — small ring in the meta row:
   - 🟢 Green = age fits child
   - 🟡 Amber = within 6 months of range edge
   - ⚫ Gray outline = out of range
   - Empty outline = age unknown
3. **Score meter** — numeric score with a small fill-bar instead of just the raw number

New prop (optional, defaults to "unknown" fit):
```ts
<EventCard event={e} childAgeMonths={cfg.child.ageMonths} />
```

### `FilterBar.tsx` (new)
Client component — chip row for filtering by Indoor / Outdoor / Free / Drop-in.
Uses AND logic across active filters. Shows per-chip event counts.

```ts
import { FilterBar, FilterId, applyFilters } from "@/components/FilterBar";

// In a client wrapper around page content:
const [active, setActive] = useState(new Set<FilterId>());
const filtered = applyFilters(events, active);
```

> **Note:** `FilterBar` is a `"use client"` component. Since `page.tsx` is a
> Server Component, you'll need a thin client wrapper (e.g. `EventList.tsx`)
> that receives the ranked events as a prop and owns the filter state.
> See the pattern below.

### Suggested client wrapper for FilterBar

```tsx
// src/components/EventList.tsx
"use client";
import { useState } from "react";
import { FilterBar, FilterId, applyFilters } from "./FilterBar";
import { EventCard } from "./EventCard";
import type { RankedEvent } from "@/lib/rank";

export function EventList({
  topPicks,
  rest,
  childAgeMonths,
}: {
  topPicks: RankedEvent[];
  rest: RankedEvent[];
  childAgeMonths: number;
}) {
  const [active, setActive] = useState(new Set<FilterId>());
  const allEvents = [...topPicks, ...rest];
  const filteredTop = applyFilters(topPicks, active);
  const filteredRest = applyFilters(rest, active);

  return (
    <>
      <FilterBar allEvents={allEvents} active={active} onChange={setActive} />
      {/* render filteredTop and filteredRest */}
    </>
  );
}
```

### `layout.tsx`
- Max-width tightened to `max-w-2xl` (672px) — better line length for cards
- Header: logo mark added, nav links use pill hover states
- Footer: "Refresh now →" link added

### `globals.css`
- Background: `#faf9f6` (warm off-white, matches existing `#fafaf7` intent)
- Custom scrollbar styling
- `animate-in` / `fade-in` / `slide-in-from-top-1` keyframes for the settings drawer
  (avoids needing `tailwindcss-animate` plugin, but compatible with it if you add it)

---

## No backend changes required

All API routes (`/api/settings`, `/api/refresh`), data types (`RankedEvent`, `EffectiveConfig`,
`HourlyForecast`), and lib utilities are unchanged. These are purely component-layer changes.
