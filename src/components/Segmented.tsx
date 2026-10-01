"use client";

import type { KeyboardEvent, ReactNode } from "react";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Für Screenreader, falls das Label nur aus einem Symbol besteht. */
  ariaLabel?: string;
}

/**
 * Segment-Umschalter mit gleitendem Thumb (reines CSS, nur `transform`).
 *
 * Semantisch eine Radiogruppe: Pfeiltasten wechseln die Auswahl, `aria-checked`
 * beschreibt den Zustand. Die Trefferfläche je Segment ist ≥ 44 px.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className = "",
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = event.key === "ArrowRight" ? 1 : -1;
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value);
    const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>("button");
    buttons[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`relative flex rounded-ctl border border-line bg-surface-2 p-1 ${className}`}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-1 left-1 rounded-xs bg-surface shadow-card transition-transform duration-300 ease-spring"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={option.ariaLabel}
            onClick={() => onChange(option.value)}
            className={`pressable relative z-10 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xs px-3 text-center text-meta font-semibold transition-colors ${
              active ? "text-ink" : "text-ink-3 hover:text-ink-2"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
