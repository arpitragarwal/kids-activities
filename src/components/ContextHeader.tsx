"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import type { WeatherSummary } from "@/lib/weather";
import type { EffectiveConfig } from "@/lib/userPrefs";
import { splitYearsMonths } from "@/lib/age";
import { pickCity } from "@/lib/address";
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
  onClose,
}: {
  cfg: EffectiveConfig;
  onClose: () => void;
}) {
  const router = useRouter();
  const { years, months } = splitYearsMonths(cfg.child.ageMonths);
  const addrDefault = cfg.home.isDefault ? "" : cfg.home.label;

  const [ageYears, setAgeYears] = useState(String(years));
  const [ageExtraMonths, setAgeExtraMonths] = useState(String(months));
  const [address, setAddress] = useState(addrDefault);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"save" | "reset" | "check" | null>(null);

  const trimmedAddress = address.trim();
  const addressChanged = trimmedAddress !== addrDefault.trim();

  const inputCls = "rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-stone-400 transition-colors";
  // Number variant strips native spinner buttons so the input doesn't lose
  // visible width to them (Chrome shows spinners on hover/focus, Firefox always).
  const numInputCls = `${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:m-0 [&::-webkit-outer-spin-button]:m-0`;

  async function postSettings(fd: FormData): Promise<{ ok?: true; error?: string; label?: string }> {
    const res = await fetch("/api/settings", {
      method: "POST",
      body: fd,
      headers: { Accept: "application/json" },
    });
    const data = (await res.json().catch(() => ({}))) as { ok?: true; error?: string; label?: string };
    if (!res.ok) {
      throw new Error(data.error ?? `Request failed (${res.status})`);
    }
    return data;
  }

  async function handleCheck() {
    if (!trimmedAddress) {
      setError("Enter an address to check");
      setPreview(null);
      return;
    }
    setBusy("check");
    setError(null);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.set("action", "preview");
      fd.set("address", trimmedAddress);
      const data = await postSettings(fd);
      setPreview(data.label ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Geocoding failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy("save");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("action", "save");
      fd.set("ageYears", ageYears);
      fd.set("ageExtraMonths", ageExtraMonths);
      if (addressChanged && trimmedAddress) fd.set("address", trimmedAddress);
      await postSettings(fd);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleReset() {
    setBusy("reset");
    setError(null);
    try {
      const fd = new FormData();
      fd.set("action", "reset");
      await postSettings(fd);
      router.refresh();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-3 bg-white border border-stone-200 rounded-xl px-4 py-3.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-3">
          {/* Age */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400">
              Age
            </label>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={0}
                max={20}
                value={ageYears}
                onChange={(e) => setAgeYears(e.target.value)}
                aria-label="Years"
                className={`w-12 text-center ${numInputCls}`}
              />
              <span className="text-xs text-stone-400">y</span>
              <input
                type="number"
                min={0}
                max={11}
                value={ageExtraMonths}
                onChange={(e) => setAgeExtraMonths(e.target.value)}
                aria-label="Months"
                className={`w-12 text-center ${numInputCls}`}
              />
              <span className="text-xs text-stone-400">m</span>
            </div>
          </div>

          {/* Address */}
          <div className="flex flex-col gap-1.5 flex-1 min-w-[240px]">
            <label className="text-[10.5px] font-semibold uppercase tracking-widest text-stone-400">
              Home address
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="500 Castro St, Mountain View"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  setPreview(null);
                  if (error) setError(null);
                }}
                className={`flex-1 min-w-0 ${inputCls}`}
              />
              <button
                type="button"
                onClick={handleCheck}
                disabled={busy !== null || !trimmedAddress || !addressChanged}
                className="shrink-0 px-2.5 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Geocode this address and show the match before saving"
              >
                {busy === "check" ? "Checking…" : "Check"}
              </button>
            </div>
            {preview && (
              <p className="text-[11.5px] text-emerald-700 leading-snug">
                ✓ Matches: {preview}
              </p>
            )}
            {!preview && !addressChanged && addrDefault && (
              <p className="text-[11.5px] text-stone-400 leading-snug truncate" title={addrDefault}>
                Currently: {addrDefault}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className="px-2 py-1.5 text-xs text-stone-400 hover:text-stone-600 disabled:opacity-60 transition-colors mr-auto"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={busy !== null}
            className="px-3 py-1.5 rounded-lg border border-stone-200 text-xs text-stone-600 hover:bg-stone-100 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
          <button
            type="submit"
            disabled={busy !== null}
            className="px-4 py-1.5 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {busy === "save" ? "Saving…" : "Save"}
          </button>
        </div>
      </form>

      {error && (
        <p className="mt-2 text-xs text-red-600" role="alert">
          {error}
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
}: {
  wx: WeatherSummary | null;
  fetchedAt: Date | null;
  dateLabel: string;
  currentTime: string;
  cfg: EffectiveConfig;
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
            <p className="text-[11.5px] font-medium text-stone-400 mb-1">{dateLabel} · {currentTime}</p>
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
          <SettingsDrawer cfg={cfg} onClose={() => setEditing(false)} />
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
        <SettingsDrawer cfg={cfg} onClose={() => setEditing(false)} />
      )}
    </div>
  );
}
