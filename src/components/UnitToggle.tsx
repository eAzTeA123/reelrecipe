"use client";

export function UnitToggle({
  value,
  onChange,
}: {
  value: "eu" | "us";
  onChange: (value: "eu" | "us") => void;
}) {
  return (
    <div className="inline-flex items-center rounded-ctl border border-line bg-surface-2 p-0.5 shadow-xs">
      <button
        type="button"
        onClick={() => onChange("eu")}
        className={`pressable rounded-ctl px-2.5 py-1 text-label font-bold transition-all ${
          value === "eu"
            ? "bg-surface text-ink shadow-xs"
            : "text-ink-3 hover:text-ink"
        }`}
        aria-pressed={value === "eu"}
      >
        🇪🇺 Metrisch (g / ml)
      </button>
      <button
        type="button"
        onClick={() => onChange("us")}
        className={`pressable rounded-ctl px-2.5 py-1 text-label font-bold transition-all ${
          value === "us"
            ? "bg-surface text-ink shadow-xs"
            : "text-ink-3 hover:text-ink"
        }`}
        aria-pressed={value === "us"}
      >
        🇺🇸 US (Cups / °F)
      </button>
    </div>
  );
}
