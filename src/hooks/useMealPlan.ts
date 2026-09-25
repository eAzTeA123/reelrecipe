import { useEffect, useState } from "react";
import type { MealPlanEntry } from "@/domain/types";
import { getMealPlanRepository } from "@/data";

export function useMealPlan() {
  const [entries, setEntries] = useState<MealPlanEntry[]>([]);

  useEffect(() => {
    const repo = getMealPlanRepository();
    const unsubscribe = repo.subscribe(
      (newEntries) => setEntries(newEntries),
      (err) => console.error("useMealPlan error", err)
    );
    return unsubscribe;
  }, []);

  return { entries };
}
