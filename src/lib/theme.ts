"use client";

import { useSyncExternalStore } from "react";

/**
 * Theme-Wahl: „system" folgt der Geräteeinstellung, „light"/„dark" setzen eine
 * ausdrückliche Wahl, die im localStorage bleibt und vor dem ersten Paint vom
 * Inline-Script in `layout.tsx` angewandt wird.
 *
 * Umgesetzt als externer Store, weil die Wahl außerhalb von React lebt
 * (localStorage + `data-theme` am <html>). `useSyncExternalStore` vermeidet
 * damit sowohl Effekte als auch Hydration-Abweichungen.
 */
export type ThemeChoice = "system" | "light" | "dark";

const STORAGE_KEY = "s2c-theme";
const listeners = new Set<() => void>();

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getThemeChoice(): ThemeChoice {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Auf dem Server gibt es keine Wahl – dort gilt immer die Systemeinstellung. */
export function getServerThemeChoice(): ThemeChoice {
  return "system";
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") {
      document.documentElement.removeAttribute("data-theme");
      localStorage.removeItem(STORAGE_KEY);
    } else {
      document.documentElement.setAttribute("data-theme", choice);
      localStorage.setItem(STORAGE_KEY, choice);
    }
  } catch {
    // Privater Modus o. Ä.: die Wahl gilt dann nur für diese Sitzung.
    if (choice !== "system") document.documentElement.setAttribute("data-theme", choice);
    else document.documentElement.removeAttribute("data-theme");
  }
  listeners.forEach((listener) => listener());
}

/** Aktuelle Wahl inklusive Re-Render bei Änderung. */
export function useThemeChoice(): ThemeChoice {
  return useSyncExternalStore(subscribeTheme, getThemeChoice, getServerThemeChoice);
}
