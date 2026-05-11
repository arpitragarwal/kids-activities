"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import type { WeatherSummary } from "@/lib/weather";
import type { EffectiveConfig } from "@/lib/userPrefs";
import { splitYearsMonths } from "@/lib/age";
import { config } from "@/lib/config";

// ─── Icons ────────────────────────────────────────────────────────────────

function PinIcon({ size = 14 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 2.65 3.5 6.5 3.5 6.5s3.5-3.85 3.5-6.5C9.5 2.567 7.933 1 6 1zm0 4.75A1.25 1.25 0 1 1 6 3.25a1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

function PersonIcon({ size = 14 }: { size?: number } = {}) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="6" cy="4" r="2.5" />
      <path d="M1.5 11c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

// ─── Address helpers ──────────────────────────────────────────────────────

const US_STATE_RE = /^(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|District of Columbia)$/i;

const STREETY_RE = /\b(Avenue|Ave|Street|St|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Place|Pl|Parkway|Pkwy|Highway|Hwy|Terrace|Ter|Circle|Cir)\.?$/i;

function pickCity(parts: string[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0];
  // Prefer the part right before "...County" or a US state name.
  for (let i = 1; i < parts.length; i++) {
    if (/county$/i.test(parts[i]) || US_STATE_RE.test(parts[i])) {
      return parts[i - 1];
    }
  }
  // Fallback: first part that doesn't look like a house number or street name.
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (/^\d+$/.test(p)) continue;
    if (STREETY_RE.test(p)) continue;
    return p;
  }
  return parts[parts.length - 1];
}

// ─── Weather helpers ──────────────────────────────────────────────────────

function weatherIcon(outdoorScore: number, precipPct: number): string {
  if (precipPct > 50) return "🌧️";
  if (outdoorScore >= 0.7) return "🌤️";
  if (outdoorScore >= 0.4) return "⛅";
  return "🌥️";
}

function weatherAdvice(outdoorScore: number): string {
  if (outdoorScore >= 0.7) return "Great outdoors — parks ranked up";
  if (outdoorScore >= 0.4) return "Mixed — indoor backups ranked";
  return "Stay inside — indoor picks first";
}

type WxTone = "great" | "mixed" | "poor";

function weatherTone(outdoorScore: number): WxTone {
  if (outdoorScore >= 0.7) return "great";
  if (outdoorScore >= 0.4) return "mixed";
  return "poor";
}

const WX_ADVICE_COLOR: Record<WxTone, string> = {
  great: "text-emerald-600",
  mixed: "text-amber-600",
  poor:  "text-stone-500",
};

// ─── Settings drawer ──────────────────────────────────────────────────────

function SettingsDrawer({
  cfg,
  status,
  error,
  onClose,
}: {
  cfg: EffectiveConfig;
  status?: string;
  error?: string;
  onClose: () => void;
}) {
  const { years, months } = splitYearsMonths(cfg.child.ageMonths);
  const addrDefault = cfg.home.isDefault ? "" : cfg.home.label;

  const inputCls = "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-stone-400 transition-colors";

  return (
    <div className="mt-3 bg-white border border-stone-200 rounded-xl px-4 py-3.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
      <form action="/api/settings" method="post" className="flex flex-wrap items-end gap-x-4 gap-y-3">
        {/* Age */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400">
            Child&apos;s age
          </label>
          <div className="flex items-center gap-1.5">
            <input
              name="ageYears"
              type="number"
              min={0}
              max={20}
              defaultValue={years}
              aria-label="Years"
              className={`w-14 text-center ${inputCls}`}
            />
            <span className="text-xs text-stone-400">y</span>
            <input
              name="ageExtraMonths"
              type="number"
              min={0}
              max={11}
              defaultValue={months}
              aria-label="Months"
              className={`w-14 text-center ${inputCls}`}
            />
            <span className="text-xs text-stone-400">m</span>
          </div>
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
          <label className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400">
            Home address
          </label>
          <input
            name="address"
            type="text"
            placeholder="500 Castro St, Mountain View"
            defaultValue={addrDefault}
            className={`w-full ${inputCls}`}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            type="submit"
            name="action"
            value="save"
            className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Save
          </button>
          <button
            type="submit"
            name="action"
            value="reset"
            className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1.5 text-xs text-stone-400 hover:text-stone-600 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>

      {(status || error) && (
        <p className={`mt-2 text-xs ${error ? "text-red-600" : "text-emerald-700"}`}>
          {error ?? (status === "saved" ? "Saved." : "Reverted to defaults.")}
        </p>
      )}
    </div>
  );
}

// ─── Profile chip ─────────────────────────────────────────────────────────

function ProfileChip({
  ageLabel,
  cityDisplay,
  editing,
  onEdit,
}: {
  ageLabel: string;
  cityDisplay: string;
  editing: boolean;
  onEdit: () => void;
}) {
  const baseCls = `group inline-flex items-center gap-2 text-[15px] font-semibold text-stone-700 bg-white border rounded-full px-4 py-2 transition-colors shrink-0 whitespace-nowrap ${
    editing ? "border-stone-400 bg-stone-50" : "border-stone-200 hover:border-stone-400 hover:bg-stone-50"
  }`;
  return (
    <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
      <button
        type="button"
        onClick={onEdit}
        className={baseCls}
        title={`${ageLabel} — click to edit`}
        aria-label={`Child's age: ${ageLabel}. Click to edit.`}
      >
        <PersonIcon />
        <span>{ageLabel}</span>
      </button>
      <button
        type="button"
        onClick={onEdit}
        className={baseCls}
        title={`${cityDisplay} — click to edit`}
        aria-label={`Location: ${cityDisplay}. Click to edit.`}
      >
        <PinIcon />
        <span>{cityDisplay}</span>
      </button>
    </div>
  );
}

// ─── ContextHeader ────────────────────────────────────────────────────────
// Replaces WeatherBanner + SettingsBar.
// Left: date + weather headline + advice. Right: age/address chips + edit toggle.

export function ContextHeader({
  wx,
  fetchedAt,
  dateLabel,
  currentTime,
  cfg,
  status,
  error,
  brokenCount = 0,
}: {
  wx: WeatherSummary | null;
  fetchedAt: Date | null;
  dateLabel: string;
  currentTime: string;
  cfg: EffectiveConfig;
  status?: string;
  error?: string;
  brokenCount?: number;
}) {
  const [editing, setEditing] = useState(false);

  const rawAddr = cfg.home.isDefault ? "Mountain View" : cfg.home.label;
  const addrParts = rawAddr.split(",").map((s) => s.trim()).filter(Boolean);
  // Show "Street, City" or just city if no street
  const addrDisplay = addrParts.length >= 2 ? `${addrParts[0]}, ${addrParts[1]}` : addrParts[0];
  // For the compact chip: just the city name. Nominatim display_name is roughly
  // "[house#], [street], [neighborhood?], [city], [...County], [state], [zip], [country]"
  // — so the part right before "...County" or a US state name is reliably the city.
  const cityDisplay = pickCity(addrParts);

  const { years, months } = splitYearsMonths(cfg.child.ageMonths);
  const ageLabel = months > 0 ? `${years}y ${months}m` : `${years}y`;

  if (!wx) {
    return (
      <div className="pb-4 border-b border-stone-200 mb-5">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[11.5px] font-medium text-stone-400 mb-1 flex items-center gap-1.5">
              <span>{dateLabel} · {currentTime}</span>
              <a href="/health" className="inline-flex items-center gap-1 ml-1 hover:text-stone-600 transition-colors">
                {brokenCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
                <span>Sources</span>
              </a>
            </p>
            <p className="text-2xl font-semibold tracking-tight text-stone-900">{dateLabel}</p>
            <p className="text-sm text-stone-400 mt-1">
              Weather not yet fetched.{" "}
              <a href="/api/refresh" className="underline">Refresh now</a>
            </p>
          </div>
          <ProfileChip
            ageLabel={ageLabel}
            cityDisplay={cityDisplay}
            editing={editing}
            onEdit={() => setEditing((v) => !v)}
          />
        </div>
        {editing && (
          <SettingsDrawer cfg={cfg} status={status} error={error} onClose={() => setEditing(false)} />
        )}
      </div>
    );
  }

  const tone = weatherTone(wx.outdoorScore);
  const icon = weatherIcon(wx.outdoorScore, wx.precipPct);
  const advice = weatherAdvice(wx.outdoorScore);

  return (
    <div className="pb-4 border-b border-stone-200 mb-5">
      <div className="flex items-start justify-between gap-5">
        {/* Left: date + weather */}
        <div>
          <p className="text-[11.5px] font-medium text-stone-400 mb-1 flex items-center gap-1.5">
            <span>{dateLabel} · {currentTime}</span>
            <a href="/health" className="inline-flex items-center gap-1 ml-1 hover:text-stone-600 transition-colors">
              {brokenCount > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />}
              <span>Sources</span>
            </a>
          </p>
          <h1 className="text-[26px] font-semibold tracking-tight text-stone-900 flex items-center gap-2 flex-wrap leading-tight">
            <span>{icon}</span>
            <span>{Math.round(wx.tempF)}°</span>
            <span className="text-[17px] font-normal text-stone-500">{wx.shortForecast}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className={`text-[13px] font-medium ${WX_ADVICE_COLOR[tone]}`}>
              {advice}
            </span>
            {wx.precipPct >= 30 && (
              <span className="text-[13px] text-stone-400">· {wx.precipPct}% rain</span>
            )}
          </div>
        </div>

        {/* Right: profile chip */}
        <ProfileChip
          ageLabel={ageLabel}
          cityDisplay={cityDisplay}
          editing={editing}
          onEdit={() => setEditing((v) => !v)}
        />
      </div>

      {editing && (
        <SettingsDrawer cfg={cfg} status={status} error={error} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
