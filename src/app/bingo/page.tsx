"use client";

import { useState, useRef, useEffect } from "react";
import { getRecipeRepository } from "@/data";
import type { Recipe } from "@/domain/types";
import { useToast } from "@/components/Toast";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";
import confetti from "canvas-confetti";
import { RecipeCard } from "@/components/RecipeCard";
import Link from "next/link";
import { IconDice, IconSearch } from "@/components/Icons";
import { EmptyState } from "@/components/EmptyState";

export default function BingoPage() {
  const [ingredients, setIngredients] = useState("");
  const [matchingRecipes, setMatchingRecipes] = useState<Recipe[]>([]);
  const [cycling, setCycling] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [winner, setWinner] = useState<Recipe | null>(null);
  const toast = useToast();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handlePlay = async () => {
    if (!ingredients.trim()) {
      toast("Bitte Zutaten eingeben!", "error");
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    const allRecipes = await getRecipeRepository().list();
    const searchTerms = ingredients
      .toLowerCase()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const matches = allRecipes.filter((recipe) => {
      return searchTerms.some(term =>
        recipe.ingredients.some(ri => ri.name.toLowerCase().includes(term))
      );
    });

    if (matches.length === 0) {
      toast("Keine passenden Rezepte gefunden", "error");
      setWinner(null);
      setMatchingRecipes([]);
      return;
    }

    setMatchingRecipes(matches);
    setWinner(null);
    setCycling(true);
    setCurrentIndex(0);

    const duration = 3000;
    const start = Date.now();
    let speed = 50;

    const tick = () => {
      const now = Date.now();
      const elapsed = now - start;

      if (elapsed > duration) {
        setCycling(false);
        const winIndex = Math.floor(Math.random() * matches.length);
        setCurrentIndex(winIndex);
        setWinner(matches[winIndex]);
        
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        return;
      }

      const progress = elapsed / duration;
      speed = 50 + Math.pow(progress, 3) * 500;

      setCurrentIndex((prev) => (prev + 1) % matches.length);
      timerRef.current = setTimeout(tick, speed);
    };

    timerRef.current = setTimeout(tick, speed);
  };

  return (
    <div className="flex flex-col h-full pb-8">
      <PageHeader
        title="Rezept-Bingo"
        subtitle="Finde zufällig dein nächstes Gericht"
      />
      <div className="flex flex-col gap-6 flex-1 max-w-xl mx-auto w-full mt-4">
        <p className="text-ink-2 px-1">
          Gib ein paar Zutaten ein, die du verwenden möchtest, und wir ziehen ein zufälliges Rezept für dich!
        </p>

        <div className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="z.B. Tomate, Feta"
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
            disabled={cycling}
            className="h-14 w-full rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <Button onClick={handlePlay} disabled={cycling} className="h-14 text-[17px]">
            <IconDice size={24} className="mr-2" />
            Bingo spielen!
          </Button>
        </div>

        <div className="mt-8 flex flex-col items-center w-full">
          {!cycling && !winner && (
            <div className="w-full rounded-2xl border border-dashed border-line bg-surface/50 p-6">
              <EmptyState 
                title="Bereit für Bingo?" 
                subtitle="Gib Zutaten ein und starte das Spiel, um ein passendes Rezept zu finden." 
                icon={<IconSearch size={32} />}
              />
            </div>
          )}

          {cycling && matchingRecipes.length > 0 && (
            <div className="w-full opacity-70 scale-95 transition-all duration-75 pointer-events-none filter blur-[1px]">
              <RecipeCard recipe={matchingRecipes[currentIndex]} />
            </div>
          )}

          {winner && !cycling && (
            <div className="w-full flex flex-col gap-4 animate-in fade-in zoom-in duration-500">
              <h2 className="text-2xl font-bold text-center text-accent mb-2">Gewinner!</h2>
              <RecipeCard recipe={winner} />
              <Link href={`/recipes/${winner.id}`} className="w-full mt-4 block">
                <Button variant="primary" className="w-full h-14 text-[17px]">
                  Zum Rezept
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
