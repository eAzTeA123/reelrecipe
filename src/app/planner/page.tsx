"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMealPlan } from "@/hooks/useMealPlan";
import { useRecipes } from "@/hooks/useRecipes";
import { getMealPlanRepository, getShoppingListRepository, getRecipeRepository } from "@/data";
import { PageHeader } from "@/components/PageHeader";
import { IconTrash, IconCart } from "@/components/Icons";
import { scaleAmount } from "@/lib/scale";
import type { DayOfWeek, MealPlanEntry, Recipe } from "@/domain/types";

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "mo", label: "Montag" },
  { key: "tu", label: "Dienstag" },
  { key: "we", label: "Mittwoch" },
  { key: "th", label: "Donnerstag" },
  { key: "fr", label: "Freitag" },
  { key: "sa", label: "Samstag" },
  { key: "su", label: "Sonntag" },
];

export default function PlannerPage() {
  const router = useRouter();
  const { entries } = useMealPlan();
  const { recipes } = useRecipes();
  const [loading, setLoading] = useState(false);

  const getEntriesForDay = (day: DayOfWeek) => entries.filter((e) => e.dayOfWeek === day);

  const addRecipe = async (day: DayOfWeek, recipeId: string) => {
    if (!recipeId) return;
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;

    const repo = getMealPlanRepository();
    await repo.add({
      dayOfWeek: day,
      recipeId,
      servings: recipe.servings || 2,
    });
  };

  const removeEntry = async (id: string) => {
    const repo = getMealPlanRepository();
    await repo.remove(id);
  };

  const updateServings = async (id: string, servings: number) => {
    if (servings < 1) return;
    const repo = getMealPlanRepository();
    await repo.update(id, { servings });
  };

  const generateShoppingList = async () => {
    setLoading(true);
    try {
      const shoppingRepo = getShoppingListRepository();
      const recipeRepo = getRecipeRepository();

      for (const entry of entries) {
        const recipe = await recipeRepo.get(entry.recipeId);
        if (!recipe) continue;

        const scaledIngredients = recipe.ingredients.map((ing) => ({
          name: ing.name,
          amount: scaleAmount(ing.amount, recipe.servings, entry.servings),
          unit: ing.unit,
        }));

        await shoppingRepo.addIngredients(scaledIngredients, recipe.id);
      }
      router.push("/shopping");
    } catch (err) {
      console.error("Failed to generate shopping list", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Wochenplan" />

      <div className="flex justify-between items-center mb-2">
        <p className="text-ink-2 text-sm">
          Plane deine Mahlzeiten für die Woche.
        </p>
        <button
          onClick={generateShoppingList}
          disabled={loading || entries.length === 0}
          className="flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white pressable disabled:opacity-50"
        >
          <IconCart size={18} />
          Woche einkaufen
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DAYS.map((day) => {
          const dayEntries = getEntriesForDay(day.key);
          return (
            <div key={day.key} className="rounded-2xl border border-line bg-surface p-4">
              <h3 className="mb-3 font-semibold text-lg">{day.label}</h3>
              
              <div className="flex flex-col gap-3 mb-3">
                {dayEntries.map((entry) => {
                  const recipe = recipes.find((r) => r.id === entry.recipeId);
                  return (
                    <div key={entry.id} className="flex items-center justify-between gap-2 rounded-lg bg-white p-2 border border-line shadow-sm">
                      <span className="flex-1 truncate text-sm font-medium">
                        {recipe ? recipe.title : "Rezept gelöscht"}
                      </span>
                      
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="1"
                          value={entry.servings}
                          onChange={(e) => updateServings(entry.id, parseInt(e.target.value) || 1)}
                          className="w-16 rounded-md border border-line px-2 py-1 text-sm"
                          aria-label="Portionen"
                        />
                        <button
                          onClick={() => removeEntry(entry.id)}
                          className="text-ink-3 hover:text-red-500 p-1"
                          aria-label="Entfernen"
                        >
                          <IconTrash size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <select
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink-2 outline-none focus:border-accent"
                onChange={(e) => {
                  addRecipe(day.key, e.target.value);
                  e.target.value = "";
                }}
                defaultValue=""
              >
                <option value="" disabled>+ Rezept hinzufügen...</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}
