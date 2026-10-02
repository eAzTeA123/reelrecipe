"use client";

import { useEffect } from "react";

/**
 * Sperrt das Zoomen dort, wo `user-scalable=no` nicht greift.
 *
 * Warum das nötig ist: **iOS Safari ignoriert `user-scalable=no`** (seit iOS 10,
 * auch mit `maximum-scale=1`). Übrig bleiben nur die Safari-eigenen
 * Gestenereignisse und das Abfangen von Mehrfinger-Bewegungen. Deshalb ist die
 * Sperre dreifach aufgebaut:
 *
 * 1. `viewport` in `layout.tsx` → `maximum-scale=1, user-scalable=no`
 *    (Android Chrome, Desktop-Browser, installierte PWA)
 * 2. `touch-action: manipulation` auf `html` (globals.css) → kein Doppeltipp-Zoom
 * 3. dieses Modul → kein Zwei-Finger-Zoom auf iOS
 *
 * Alle drei betreffen **nur** Mehrfinger- und Doppeltipp-Gesten. Ein Finger
 * scrollt unverändert; Ziehen (z. B. im Wochenplan) funktioniert weiter, weil
 * dort `touch-action: none` direkt am Body gesetzt wird.
 *
 * Zum Nachweis in Tests setzt der Wächter `data-zoom-guard="active"` am
 * Wurzelelement – so ist prüfbar, dass er wirklich geladen ist.
 */
export function ZoomGuard() {
  useEffect(() => {
    const prevent = (event: Event) => {
      event.preventDefault();
    };

    // Safari-Gesten (nicht standardisiert, aber genau das, was iOS auswertet).
    const gestures = ["gesturestart", "gesturechange", "gestureend"] as const;
    // TypeScript kennt diese Ereignisse nicht; der Aufruf wird deshalb über eine
    // schmale Signatur geführt statt über `any`.
    const subscribe = (name: string, handler: EventListener, options?: AddEventListenerOptions) => {
      (document.addEventListener as (type: string, listener: EventListener, options?: AddEventListenerOptions) => void)(
        name,
        handler,
        options,
      );
      return () => {
        (document.removeEventListener as (type: string, listener: EventListener, options?: AddEventListenerOptions) => void)(
          name,
          handler,
          options,
        );
      };
    };

    const unsubscribe = gestures.map((name) => subscribe(name, prevent));

    // Zwei Finger = Zoomversuch. `passive: false` ist entscheidend: Safari
    // behandelt `touchmove` am Dokument sonst passiv und ignoriert
    // `preventDefault` stillschweigend.
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length > 1) event.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });
    document.documentElement.dataset.zoomGuard = "active";

    return () => {
      for (const release of unsubscribe) release();
      document.removeEventListener("touchmove", onTouchMove);
      delete document.documentElement.dataset.zoomGuard;
    };
  }, []);

  return null;
}
