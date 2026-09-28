"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { RetailerFilter, ShoppingEstimate } from "@/domain/productTypes";
import type { EstimateIngredient } from "@/lib/products/estimate";

const RETAILER_KEY = "ReelRecipe-retailer";
const RETAILER_VALUES = new Set(["all", "lidl", "aldi_sued", "aldi_nord", "rewe", "edeka", "kaufland", "penny", "netto"]);

/** Gewählter Markt, geräteweit gemerkt (Rezeptdetail und Einkaufsliste teilen ihn) */
export function useSelectedRetailer(): [RetailerFilter, (r: RetailerFilter) => void] {
  const [retailer, setRetailerState] = useState<RetailerFilter>(() => {
    if (typeof window === "undefined") return "all";
    try {
      const saved = localStorage.getItem(RETAILER_KEY);
      return saved && RETAILER_VALUES.has(saved) ? (saved as RetailerFilter) : "all";
    } catch {
      return "all";
    }
  });
  const setRetailer = useCallback((r: RetailerFilter) => {
    setRetailerState(r);
    try {
      localStorage.setItem(RETAILER_KEY, r);
    } catch {
      // Speichern optional
    }
  }, []);
  return [retailer, setRetailer];
}

interface Result {
  key: string;
  data?: ShoppingEstimate;
  error?: boolean;
}

/**
 * Lädt die Einkaufsschätzung unabhängig vom Rest der Seite (blockiert das Rezept nicht).
 * Anfragen werden kurz entprellt und bei Änderungen abgebrochen.
 */
export function useShoppingEstimate(ingredients: EstimateIngredient[], retailer: RetailerFilter) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<Result | null>(null);

  const requestKey = useMemo(
    () =>
      JSON.stringify({
        ingredients: ingredients.map((i) => ({ id: i.id, name: i.name, amount: i.amount, unit: i.unit })),
        retailer,
        attempt,
      }),
    [ingredients, retailer, attempt],
  );
  const enabled = ingredients.length > 0;

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const { ingredients: body, retailer: r } = JSON.parse(requestKey);
      fetch("/api/shopping/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients: body, retailer: r }),
        signal: controller.signal,
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((data: ShoppingEstimate) => setResult({ key: requestKey, data }))
        .catch((e) => {
          if (controller.signal.aborted) return;
          console.warn("Einkaufsschätzung fehlgeschlagen", e);
          setResult({ key: requestKey, error: true });
        });
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [requestKey, enabled]);

  const current = result?.key === requestKey ? result : null;
  // Bei Marktwechsel die letzte Schätzung weiter zeigen, bis neue Daten da sind
  const stale = !current && result?.data ? result.data : undefined;

  return {
    data: current?.data ?? stale,
    loading: enabled && !current,
    error: Boolean(current?.error),
    retry: useCallback(() => setAttempt((a) => a + 1), []),
  };
}
