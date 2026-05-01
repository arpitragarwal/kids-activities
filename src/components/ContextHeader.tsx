"use client";

import { useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import type { WeatherSummary } from "@/lib/weather";
import type { EffectiveConfig } from "@/lib/userPrefs";
import { splitYearsMonths } from "@/lib/age";
import { config } from "@/lib/config";

// ─── Icons ────────────────────────────────────────────────────────────────

function PinIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M6 1C4.067 1 2.5 2.567 2.5 4.5c0 2.65 3.5 6.5 3.5 6.5s3.5-3.85 3.5-6.5C9.5 2.567 7.933 1 6 1zm0 4.75A1.25 1.25 0 1 1 6 3.25a1.25 1.25 0 0 1 0 2.5z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="6" cy="4" r="2.5" />
      <path d="M1.5 11c0-2.485 2.015-4.5 4.5-4.5s4.5 2.015 4.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" aria-hidden="true">
      <path d="M8.5 1.5l2 2-7 7H1.5v-2l7-7z" />
    </svg>
  );
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

  return (
    <div className="mt-3 bg-white border border-stone-200 rounded-xl px-4 py-3.5 shadow-md animate-in fade-in slide-in-from-top-1 duration-150">
      <form action="/api/settings" method="post" className="flex flex-wrap items-end gap-4">
        {/* Age */}
        <div className="flex flex-col gap-1">
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
              className="w-14 rounded-md border border-stone-300 bg-stone-50 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
            />
            <span className="text-xs text-stone-400 font-medium">y</span>
            <input
              name="ageExtraMonths"
              type="number"
              min={0}
              max={11}
              defaultValue={months}
              aria-label="Months"
              className="w-14 rounded-md border border-stone-300 bg-stone-50 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
            />
            <span className="text-xs text-stone-400 font-medium">m</span>
          </div>
        </div>

        {/* Address */}
        <div className="flex flex-col gap-1 flex-1 min-w-[200px]">
          <label className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400">
            Home address
          </label>
          <input
            name="address"
            type="text"
            placeholder="500 Castro St, Mountain View"
            defaultValue={addrDefault}
            className="w-full rounded-md border border-stone-300 bg-stone-50 px-2 py-1.5 text-sm outline-none focus:border-stone-500"
          />
          <span className="text-[10px] text-stone-400">Used for distance ranking</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-end pb-[1px]">
          <button
            type="submit"
            name="action"
            value="save"
            className="px-3.5 py-1.5 rounded-md bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors"
          >
            Save
          </button>
          <button
            type="submit"
            name="action"
            value="reset"
            className="px-2.5 py-1.5 rounded-md border border-stone-300 text-xs text-stone-600 hover:bg-stone-100 transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-2.5 py-1.5 rounded-md text-xs text-stone-400 hover:text-stone-600 transition-colors"
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

// ─── Profile chips ────────────────────────────────────────────────────────

function ProfileChips({
  ageLabel,
  addrDisplay,
  editing,
  onEdit,
  saved,
}: {
  ageLabel: string;
  addrDisplay: string;
  editing: boolean;
  onEdit: () => void;
  saved: boolean;
}) {
  return (
    <div className="flex flex-col items-end gap-2 shrink-0">
      <div className="flex gap-1.5 flex-wrap justify-end">
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-full px-2.5 py-1">
          <PersonIcon />
          {ageLabel}
        </span>
        <span
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-600 bg-white border border-stone-200 rounded-full px-2.5 py-1 max-w-[180px] truncate"
          title={addrDisplay}
        >
          <PinIcon />
          {addrDisplay}
        </span>
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center gap-1 text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
      >
        <EditIcon />
        {editing ? "Cancel" : saved ? "Saved ✓" : "Edit profile"}
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
}: {
  wx: WeatherSummary | null;
  fetchedAt: Date | null;
  dateLabel: string;
  currentTime: string;
  cfg: EffectiveConfig;
  status?: string;
  error?: string;
}) {
  const [editing, setEditing] = useState(false);

  const rawAddr = cfg.home.isDefault ? "Mountain View (default)" : cfg.home.label;
  const addrParts = rawAddr.split(",").map((s) => s.trim());
  const addrDisplay =
    addrParts.length >= 2 ? `${addrParts[0]}, ${addrParts[1]}` : addrParts[0];

  const { years, months } = splitYearsMonths(cfg.child.ageMonths);
  const ageLabel = months > 0 ? `${years}y ${months}m old` : `${years}y old`;

  const saved = status === "saved" && !editing;

  if (!wx) {
    return (
      <div className="pb-4 border-b border-stone-200 mb-5">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400 mb-1">
              Today · {currentTime}
            </p>
            <p className="text-2xl font-semibold tracking-tight text-stone-900">{dateLabel}</p>
            <p className="text-sm text-stone-400 mt-1">
              Weather not yet fetched.{" "}
              <a href="/api/refresh" className="underline">Refresh now</a>
            </p>
          </div>
          <ProfileChips
            ageLabel={ageLabel}
            addrDisplay={addrDisplay}
            editing={editing}
            onEdit={() => setEditing((v) => !v)}
            saved={saved}
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
          <p className="text-[11.5px] font-medium text-stone-400 mb-1">
            {dateLabel} · {currentTime}
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
            {fetchedAt && (
              <span className="text-[10px] text-stone-300">
                · updated {formatInTimeZone(fetchedAt, config.timezone, "h:mm a")}
              </span>
            )}
          </div>
        </div>

        {/* Right: profile */}
        <ProfileChips
          ageLabel={ageLabel}
          addrDisplay={addrDisplay}
          editing={editing}
          onEdit={() => setEditing((v) => !v)}
          saved={saved}
        />
      </div>

      {editing && (
        <SettingsDrawer cfg={cfg} status={status} error={error} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
