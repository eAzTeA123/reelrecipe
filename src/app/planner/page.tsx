"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMealPlan } from "@/hooks/useMealPlan";
import { useRecipes } from "@/hooks/useRecipes";
import { getMealPlanRepository, getShoppingListRepository, getRecipeRepository } from "@/data";
import { PageHeader } from "@/components/PageHeader";
import { IconTrash, IconCart, IconPlus, IconMinus } from "@/components/Icons";
import { RecipeImage } from "@/components/RecipeImage";
import { DragHandle } from "@/components/DragHandle";
import { scaleAmount } from "@/lib/scale";
import type { DayOfWeek } from "@/domain/types";

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

  const [draggedEntryId, setDraggedEntryId] = useState<string | null>(null);
  const [dropTargetDay, setDropTargetDay] = useState<DayOfWeek | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!draggedEntryId) return;
    
    document.body.style.touchAction = 'none'; // Prevent scrolling while dragging

    const handleMove = (e: PointerEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });
      
      // Manually find the drop target under the pointer
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const section = el?.closest('[data-day]');
      if (section) {
        const day = section.getAttribute('data-day') as DayOfWeek;
        setDropTargetDay(day);
      } else {
        setDropTargetDay(null);
      }
    };
    
    const handleUp = async (e: PointerEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const section = el?.closest('[data-day]');
      if (section) {
        const day = section.getAttribute('data-day') as DayOfWeek;
        
        // Handle drop logic directly here!
        const repo = getMealPlanRepository();
        const entry = entries.find(en => en.id === draggedEntryId);
        if (entry && entry.dayOfWeek !== day) {
           await repo.update(draggedEntryId, { dayOfWeek: day });
        }
      }
      setDraggedEntryId(null);
      setDropTargetDay(null);
    };
    
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      document.body.style.touchAction = '';
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [draggedEntryId]);

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

  const updateServings = async (id: string, currentServings: number, delta: number) => {
    const newServings = currentServings + delta;
    if (newServings < 1) return;
    const repo = getMealPlanRepository();
    await repo.update(id, { servings: newServings });
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

  const handleDragStart = (entryId: string, clientX?: number, clientY?: number) => {
    setDraggedEntryId(entryId);
    if (clientX !== undefined && clientY !== undefined) {
      setPointerPos({ x: clientX, y: clientY });
    }
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(50);
  };

  const handlePointerDown = (entryId: string, e: React.PointerEvent) => {
    const x = e.clientX;
    const y = e.clientY;
    longPressTimer.current = setTimeout(() => {
      handleDragStart(entryId, x, y);
    }, 300);
  };

  const handlePointerMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const handleDrop = async (targetDay: DayOfWeek) => {
    if (!draggedEntryId) return;
    
    const entry = entries.find(e => e.id === draggedEntryId);
    if (!entry || entry.dayOfWeek === targetDay) {
      setDraggedEntryId(null);
      setDropTargetDay(null);
      return;
    }

    const repo = getMealPlanRepository();
    await repo.update(draggedEntryId, { dayOfWeek: targetDay });
    
    setDraggedEntryId(null);
    setDropTargetDay(null);
  };

  return (
    <>
      {draggedEntryId && (
        <div
          className="fixed pointer-events-none z-50 bg-surface shadow-2xl rounded-xl p-3 opacity-90 rotate-2 scale-105 flex gap-3 items-center"
          style={{ left: pointerPos.x - 50, top: pointerPos.y - 20 }}
        >
          <p className="text-sm font-semibold truncate max-w-[200px]">
            {recipes.find(r => r.id === entries.find(e => e.id === draggedEntryId)?.recipeId)?.title ?? "Rezept"}
          </p>
        </div>
      )}
      <div className="flex flex-col gap-4">
      {/* Mobile-friendly header with an inline button underneath on small screens, or in action slot on larger screens */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <PageHeader title="Wochenplan" subtitle="Plane deine Mahlzeiten für die Woche." />
        <button
          onClick={generateShoppingList}
          disabled={loading || entries.length === 0}
          className="flex items-center justify-center gap-2 rounded-full bg-brand-gradient px-5 py-3 font-semibold text-white shadow-card transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none md:mt-1 shrink-0"
        >
          <IconCart size={20} />
          Woche einkaufen
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mt-2">
        {DAYS.map((day) => {
          const dayEntries = getEntriesForDay(day.key);
          return (
            <section
              key={day.key}
              data-day={day.key}
              className={`flex flex-col rounded-card p-4 shadow-card transition-colors ${
                dropTargetDay === day.key
                  ? "border-2 border-accent bg-accent/5"
                  : "border-2 border-transparent bg-surface"
              }`}
            >
              <h3 className="mb-4 font-bold text-lg text-ink-1">{day.label}</h3>
              
              <div className="flex flex-col gap-3 flex-1">
                {dayEntries.map((entry) => {
                  const recipe = recipes.find((r) => r.id === entry.recipeId);
                  
                  return (
                    <div
                      key={entry.id}
                      className={`group relative flex gap-3 rounded-2xl bg-white p-3 shadow-sm border border-line items-center transition-all ${
                        draggedEntryId === entry.id ? "opacity-50 scale-95" : ""
                      }`}
                      onPointerDown={(e) => handlePointerDown(entry.id, e)}
                      onPointerMove={handlePointerMove}
                      onPointerUp={handlePointerUp}
                      onPointerCancel={handlePointerUp}
                    >
                      <DragHandle entryId={entry.id} onDragStart={handleDragStart} />
                      {recipe ? (
                        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface">
                          <RecipeImage imageRef={recipe.image} alt={recipe.title} className="h-full w-full object-cover" />
                        </div>
                      ) : (
                        <div className="h-14 w-14 shrink-0 rounded-xl bg-surface flex items-center justify-center text-ink-3">
                          ?
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="truncate font-semibold text-ink-1 text-[15px]">
                          {recipe ? recipe.title : "Rezept gelöscht"}
                        </h4>
                        <div className="mt-1.5 flex items-center gap-1 text-ink-3">
                          <div className="flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 border border-line/50">
                            <button 
                              onClick={() => updateServings(entry.id, entry.servings, -1)}
                              className="p-1 hover:text-ink-1 transition-colors"
                              aria-label="Portion reduzieren"
                            >
                              <IconMinus size={14} />
                            </button>
                            <span className="w-4 text-center text-sm font-semibold text-ink-1">{entry.servings}</span>
                            <button 
                              onClick={() => updateServings(entry.id, entry.servings, 1)}
                              className="p-1 hover:text-ink-1 transition-colors"
                              aria-label="Portion erhöhen"
                            >
                              <IconPlus size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => removeEntry(entry.id)}
                        className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full text-ink-3 hover:bg-red-50 hover:text-red-500 transition-colors"
                        aria-label="Aus Plan entfernen"
                      >
                        <IconTrash size={20} />
                      </button>
                    </div>
                  );
                })}

                {/* Spacer to push the add button to the bottom if list is short */}
                <div className="flex-1" />

                {/* Add Button with Native Select Overlay */}
                <div className="relative mt-2">
                  <button className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line py-3 text-[15px] font-medium text-ink-3 transition-colors hover:border-accent hover:bg-accent/5 hover:text-accent">
                    <IconPlus size={18} />
                    <span>Rezept hinzufügen</span>
                  </button>
                  <select
                    className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                    onChange={(e) => {
                      addRecipe(day.key, e.target.value);
                      e.target.value = "";
                    }}
                    value=""
                  >
                    <option value="" disabled>Rezept für {day.label} wählen...</option>
                    {recipes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
    </>
  );
}
