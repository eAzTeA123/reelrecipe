"use client";

import { Segmented } from "./Segmented";

/**
 * Maßeinheiten: gleitender Segment-Umschalter statt zweier starrer Knöpfe.
 * Kurze Beschriftungen, damit beide Segmente gleich breit bleiben (der Thumb
 * wird per CSS verschoben, nicht gemessen).
 */
export function UnitToggle({
  value,
  onChange,
}: {
  value: "eu" | "us";
  onChange: (value: "eu" | "us") => void;
}) {
  return (
    <Segmented
      ariaLabel="Maßeinheiten"
      className="w-[13.5rem]"
      value={value}
      onChange={onChange}
      options={[
        { value: "eu", label: "g / ml", ariaLabel: "Metrische Einheiten" },
        { value: "us", label: "Cups / °F", ariaLabel: "US-Einheiten" },
      ]}
    />
  );
}
