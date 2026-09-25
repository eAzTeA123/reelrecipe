"use client";

import { useEffect, useState } from "react";
import type { ShoppingItem } from "@/domain/types";
import { getShoppingListRepository } from "@/data";

const LOAD_ERROR = "Die Einkaufsliste konnte nicht geladen werden. Bitte versuche es erneut.";

export function useShoppingList(): {
  items: ShoppingItem[];
  loading: boolean;
  error?: string;
  retry: () => void;
} {
  const [state, setState] = useState<{
    items: ShoppingItem[];
    loading: boolean;
    error?: string;
  }>({ items: [], loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    try {
      const unsub = getShoppingListRepository().subscribe(
        (items) => setState({ items, loading: false }),
        (err) => {
          console.error("shopping list load failed", err);
          setState((s) => ({ ...s, loading: false, error: LOAD_ERROR }));
        },
      );
      return unsub;
    } catch (err) {
      console.error("shopping subscription unavailable", err);
      queueMicrotask(() =>
        setState((s) => ({ ...s, loading: false, error: LOAD_ERROR })),
      );
      return undefined;
    }
  }, [attempt]);

  return { ...state, retry: () => setAttempt((a) => a + 1) };
}
