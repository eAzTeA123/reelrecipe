"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@/domain/types";
import { getRecipeRepository } from "@/data";

const LOAD_ERROR = "Das Rezept konnte nicht geladen werden. Bitte versuche es erneut.";

export function useRecipe(id: string): {
  recipe: Recipe | undefined;
  loading: boolean;
  error?: string;
  retry: () => void;
} {
  const [state, setState] = useState<{
    id: string;
    recipe?: Recipe;
    loading: boolean;
    error?: string;
  }>({ id, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    try {
      const unsub = getRecipeRepository().subscribe(
        undefined,
        (all) =>
          setState({ id, recipe: all.find((r) => r.id === id), loading: false }),
        (err) => {
          console.error("recipe load failed", err);
          setState((s) => ({ ...s, id, loading: false, error: LOAD_ERROR }));
        },
      );
      return unsub;
    } catch (err) {
      console.error("recipe subscription unavailable", err);
      queueMicrotask(() =>
        setState((s) => ({ ...s, id, loading: false, error: LOAD_ERROR })),
      );
      return undefined;
    }
  }, [id, attempt]);

  const current = state.id === id ? state : { id, loading: true };
  return {
    recipe: current.recipe,
    loading: current.loading,
    error: current.error,
    retry: () => setAttempt((a) => a + 1),
  };
}
