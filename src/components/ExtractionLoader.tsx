"use client";

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
}: {
  label: string;
  progress?: number;
}) {
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

      <p className="text-body font-medium text-ink-2">{label}</p>
    </div>
  );
}
