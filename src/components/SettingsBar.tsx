import type { EffectiveConfig } from "@/lib/userPrefs";
import { splitYearsMonths, formatAge } from "@/lib/age";

export function SettingsBar({
  cfg,
  status,
  error,
}: {
  cfg: EffectiveConfig;
  status?: string;
  error?: string;
}) {
  const { years, months } = splitYearsMonths(cfg.child.ageMonths);
  const homeLabel = cfg.home.isDefault
    ? "Mountain View (default)"
    : cfg.home.label.split(",").slice(0, 2).join(",");

  return (
    <section className="border border-stone-200 rounded-lg bg-white p-3 mb-4">
      <form action="/api/settings" method="post" className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label className="text-[11px] uppercase tracking-wide text-stone-500">
            Kid age
          </label>
          <div className="mt-0.5 flex items-center gap-1">
            <input
              name="ageYears"
              type="number"
              min={0}
              max={20}
              defaultValue={years}
              aria-label="Years"
              className="w-14 rounded border border-stone-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-stone-500">y</span>
            <input
              name="ageExtraMonths"
              type="number"
              min={0}
              max={11}
              defaultValue={months}
              aria-label="Months"
              className="w-14 rounded border border-stone-300 px-2 py-1 text-sm"
            />
            <span className="text-xs text-stone-500">m</span>
          </div>
          <span className="text-[10px] text-stone-400 mt-0.5">
            now: {formatAge(cfg.child.ageMonths)}
          </span>
        </div>

        <div className="flex flex-col flex-1 min-w-[220px]">
          <label className="text-[11px] uppercase tracking-wide text-stone-500">
            Home address
          </label>
          <input
            name="address"
            type="text"
            placeholder="500 Castro St, Mountain View"
            className="mt-0.5 w-full rounded border border-stone-300 px-2 py-1 text-sm"
          />
          <span className="text-[10px] text-stone-400 mt-0.5 truncate">
            now: {homeLabel}
          </span>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            name="action"
            value="save"
            className="px-3 py-1 rounded bg-black text-white text-sm hover:bg-stone-800"
          >
            Save
          </button>
          <button
            type="submit"
            name="action"
            value="reset"
            className="px-2 py-1 rounded border border-stone-300 text-xs text-stone-600 hover:bg-stone-100"
            title="Clear saved settings"
          >
            Reset
          </button>
        </div>
      </form>

      {(status || error) && (
        <div
          className={`mt-2 text-xs ${
            error ? "text-red-700" : "text-emerald-700"
          }`}
        >
          {error ?? (status === "saved" ? "Saved." : "Reverted to defaults.")}
        </div>
      )}
    </section>
  );
}
