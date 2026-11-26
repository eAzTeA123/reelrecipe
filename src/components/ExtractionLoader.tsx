"use client";

import { useEffect, useState } from "react";

/**
 * Ladeanimation für die Extraktion: „Topf mit Dampf", reines CSS und nur
 * `transform`/`opacity`. Bei `prefers-reduced-motion` steht der Dampf still,
 * dann trägt der Text die Information („Wir lesen die Zutaten …").
 *
 * `progress` (0–1) zeigt echte Phasen als Balken; ohne Wert läuft der Dampf
 * als unbestimmte Rückmeldung.
 */
export function ExtractionLoader({
  label,
  progress,
  phases,
}: {
  label: string;
  progress?: number;
  /** Optionale Schrittliste (rein visuell, zeitgesteuert; letzte Phase bleibt aktiv). */
  phases?: string[];
}) {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    if (!phases || phases.length < 2) return;
    const id = setInterval(() => setPhase((p) => Math.min(p + 1, phases.length - 1)), 1600);
    return () => clearInterval(id);
  }, [phases]);

  return (
    <div
      className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface px-6 py-8 text-center shadow-card"
      role="status"
    >
      <div className="loader-pot" aria-hidden>
        <span className="loader-pot__steam" />
        <span className="loader-pot__steam" />
        <span className="loader-pot__steam" />
        <span className="loader-pot__body" />
      </div>

      {progress !== undefined && (
        <div className="h-1.5 w-40 overflow-hidden rounded-pill bg-surface-2" aria-hidden>
          <div
            className="h-full origin-left rounded-pill bg-accent transition-transform duration-500 ease-out"
            style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }}
          />
        </div>
      )}

      {phases && phases.length > 0 ? (
        <ul className="flex flex-col gap-1.5 text-left text-body text-ink-2" aria-label={label}>
          {phases.map((text, i) => {
            const state = i < phase ? "done" : i === phase ? "active" : "todo";
            return (
              <li key={text} data-state={state} className="phase-item flex items-center gap-2 font-medium">
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="phase-check shrink-0 text-accent">
                  <path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={state === "active" ? "text-ink" : ""}>{text}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-body font-medium text-ink-2">{label}</p>
      )}
    </div>
  );
}
