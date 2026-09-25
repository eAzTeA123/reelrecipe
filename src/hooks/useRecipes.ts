"use client";

import { useEffect, useState } from "react";
import type { Recipe } from "@/domain/types";
import { getRecipeRepository, type SearchFilter } from "@/data";

interface RecipeListState {
  key: string;
  recipes: Recipe[];
  loading: boolean;
  error?: string;
}

const LOAD_ERROR = "Die Rezepte konnten nicht geladen werden. Bitte versuche es erneut.";

export function useRecipes(filter?: SearchFilter): {
  recipes: Recipe[];
  loading: boolean;
  error?: string;
  retry: () => void;
} {
  const key = JSON.stringify(filter ?? {});
  const [state, setState] = useState<RecipeListState>({
    key,
    recipes: [],
    loading: true,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    try {
      const unsub = getRecipeRepository().subscribe(
        JSON.parse(key) as SearchFilter,
        (recipes) => setState({ key, recipes, loading: false }),
        (err) => {
          console.error("recipes load failed", err);
          setState((s) => ({ ...s, key, loading: false, error: LOAD_ERROR }));
        },
      );
      return unsub;
    } catch (err) {
      console.error("recipes subscription unavailable", err);
      queueMicrotask(() =>
        setState((s) => ({ ...s, key, loading: false, error: LOAD_ERROR })),
      );
      return undefined;
    }
  }, [key, attempt]);

  const current = state.key === key ? state : { key, recipes: [], loading: true };
  return {
    recipes: current.recipes,
    loading: current.loading,
    error: current.error,
    retry: () => setAttempt((a) => a + 1),
  };
}
