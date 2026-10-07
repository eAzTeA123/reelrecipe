"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Rendert lange Listen in Portionen statt auf einmal.
 *
 * Anlass (gemessen, 800 Rezepte): IndexedDB liefert die Bibliothek in 44 ms und
 * die Seite steht ohne Karten in 359 ms – aber React baute alle 800 Karten in
 * einem Zug auf. Dadurch erschien selbst die **erste** Karte erst nach 5,4 s,
 * der Wechsel auf einen anderen Tab kostete 3,3 s (800 Karten abbauen) und
 * Scrollen erzeugte 12 Sekunden Arbeit auf dem Hauptthread.
 *
 * Jetzt werden zunächst `initial` Einträge gerendert; ein Beobachter am Ende der
 * Liste lädt `step` weitere nach, sobald man sich ihm nähert. Die Reihenfolge
 * bleibt vollständig – gescrollt wird durch die ganze Bibliothek, nur in
 * Scheiben.
 *
 * `resetKey` bestimmt, wann die Liste wieder oben beginnt (Suche, Filter, andere
 * Sammlung). Bewusst ein **einfacher, stabiler Wert** (z. B. die Suchanfrage)
 * und nicht die Array-Identität: Datenquellen liefern beim Laden gern bei jedem
 * Rendern ein neues Array – daran hatte sich die Liste in einer Render-Schleife
 * verfangen (React-Fehler #301, gemessen). Ohne `resetKey` bleibt die Liste, wo
 * sie ist.
 */
export function useProgressiveList<T>(
  items: T[],
  {
    initial = 48,
    step = 48,
    resetKey = "static",
  }: { initial?: number; step?: number; resetKey?: string | number } = {},
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  /*
   * Der Zustand merkt sich, zu welchem Schlüssel die Anzahl gehört. Ändert sich
   * der Schlüssel, beginnt die Liste wieder oben – als Zustandsanpassung **beim
   * Rendern** statt in einem Effect, damit kein zusätzlicher Renderdurchlauf mit
   * der alten, zu langen Liste entsteht.
   */
  const [state, setState] = useState<{ key: string | number; visible: number }>({
    key: resetKey,
    visible: initial,
  });
  if (!Object.is(state.key, resetKey)) {
    setState({ key: resetKey, visible: initial });
  }

  const visible = Object.is(state.key, resetKey) ? state.visible : initial;
  const canObserve = typeof IntersectionObserver !== "undefined";
  // Ohne Beobachter (sehr alte Browser) lieber alles zeigen als abschneiden.
  const shown = useMemo(
    () => (canObserve ? items.slice(0, visible) : items),
    [canObserve, items, visible],
  );
  const hasMore = canObserve && visible < items.length;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setState((current) =>
          // Nur verlängern, wenn noch dieselbe Liste gilt – sonst hat der
          // Rendern-Reset bereits wieder oben angefangen.
          Object.is(current.key, resetKey)
            ? { key: current.key, visible: Math.min(current.visible + step, items.length) }
            : current,
        );
      },
      // Großzügiger Vorlauf: Die nächste Portion ist fertig, bevor man sie sieht
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, step, items.length, shown.length, resetKey]);

  return { shown, hasMore, sentinelRef, total: items.length };
}
