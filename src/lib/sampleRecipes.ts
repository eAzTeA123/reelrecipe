import type { RecipeInput } from "@/domain/types";
import { newId } from "./text";

export function getSampleRecipes(lang: "de" | "en" = "de"): RecipeInput[] {
  if (lang === "en") {
    return [
      {
        title: "Creamy One-Pot Tomato Pasta",
        description: "Super fast, delicious pasta cooked right in one pot. Rich, creamy, and ready in 20 minutes!",
        servings: 2,
        prepTime: 5,
        cookTime: 15,
        category: "Dinner",
        favorite: true,
        ingredients: [
          { id: newId(), amount: 250, unit: "g", name: "Penne pasta" },
          { id: newId(), amount: 400, unit: "g", name: "Diced canned tomatoes" },
          { id: newId(), amount: 1, unit: "ball", name: "Fresh Mozzarella" },
          { id: newId(), amount: 1, unit: "clove", name: "Garlic" },
          { id: newId(), amount: 2, unit: "EL", name: "Olive oil" },
          { id: newId(), amount: 1, unit: "TL", name: "Salt" },
          { id: newId(), amount: 0.5, unit: "TL", name: "Black pepper" },
          { id: newId(), amount: 1, unit: "handful", name: "Fresh basil" },
        ],
        steps: [
          {
            id: newId(),
            order: 1,
            instruction: "Finely mince the garlic and sauté in a deep pan with 2 EL olive oil for 1 minute until fragrant.",
          },
          {
            id: newId(),
            order: 2,
            instruction: "Add the diced tomatoes and 400 ml water. Bring to a gentle boil.",
          },
          {
            id: newId(),
            order: 3,
            instruction: "Add the dry pasta directly into the sauce. Simmer over medium heat for 10-12 minutes, stirring occasionally, until al dente.",
          },
          {
            id: newId(),
            order: 4,
            instruction: "Tear the mozzarella into chunks, stir into the warm pasta until melted and creamy. Top with fresh basil.",
          },
        ],
      },
      {
        title: "Crispy Feta Avocado Toast",
        description: "The viral breakfast toast with smashed avocado, sunny-side egg, and crumbly feta.",
        servings: 1,
        prepTime: 5,
        cookTime: 5,
        category: "Breakfast",
        favorite: false,
        ingredients: [
          { id: newId(), amount: 2, unit: "slices", name: "Sourdough bread" },
          { id: newId(), amount: 1, unit: "piece", name: "Ripe avocado" },
          { id: newId(), amount: 50, unit: "g", name: "Feta cheese" },
          { id: newId(), amount: 1, unit: "piece", name: "Egg" },
          { id: newId(), amount: 1, unit: "pinch", name: "Chili flakes" },
          { id: newId(), amount: 1, unit: "splash", name: "Lemon juice" },
          { id: newId(), amount: 1, unit: "TL", name: "Olive oil" },
        ],
        steps: [
          {
            id: newId(),
            order: 1,
            instruction: "Toast the sourdough slices until golden brown and crispy.",
          },
          {
            id: newId(),
            order: 2,
            instruction: "Mash the avocado with lemon juice, salt, and pepper using a fork. Spread generously over the toasts.",
          },
          {
            id: newId(),
            order: 3,
            instruction: "Fry the egg in a hot pan with olive oil for 3 minutes until the edges are crispy but the yolk is runny.",
          },
          {
            id: newId(),
            order: 4,
            instruction: "Place the egg on top of the avocado, crumble feta all over, and season with chili flakes.",
          },
        ],
      },
      {
        title: "Berry Power Smoothie",
        description: "Refreshing, energizing smoothie packed with antioxidants, fiber, and wholesome goodness.",
        servings: 1,
        prepTime: 3,
        cookTime: 0,
        category: "Snack",
        favorite: false,
        ingredients: [
          { id: newId(), amount: 150, unit: "g", name: "Frozen mixed berries" },
          { id: newId(), amount: 1, unit: "piece", name: "Banana" },
          { id: newId(), amount: 200, unit: "ml", name: "Oat milk" },
          { id: newId(), amount: 1, unit: "EL", name: "Chia seeds" },
          { id: newId(), amount: 1, unit: "EL", name: "Almond butter" },
        ],
        steps: [
          {
            id: newId(),
            order: 1,
            instruction: "Add frozen berries, banana, oat milk, chia seeds, and almond butter into a blender.",
          },
          {
            id: newId(),
            order: 2,
            instruction: "Blend on high speed for 45-60 seconds until completely creamy and smooth.",
          },
          {
            id: newId(),
            order: 3,
            instruction: "Pour into a tall glass and enjoy immediately!",
          },
        ],
      },
    ];
  }

  return [
    {
      title: "Cremige One-Pot Tomaten-Pasta",
      description: "Super schnelle Wohlfühl-Pasta direkt in einem Topf zubereitet. Herrlich cremig und in 20 Minuten fertig!",
      servings: 2,
      prepTime: 5,
      cookTime: 15,
      category: "Hauptgericht",
      favorite: true,
      ingredients: [
        { id: newId(), amount: 250, unit: "g", name: "Penne oder Spaghetti" },
        { id: newId(), amount: 400, unit: "g", name: "Gehackte Tomaten (Dose)" },
        { id: newId(), amount: 1, unit: "Kugel", name: "Mozzarella" },
        { id: newId(), amount: 1, unit: "Zehe", name: "Knoblauch" },
        { id: newId(), amount: 2, unit: "EL", name: "Olivenöl" },
        { id: newId(), amount: 1, unit: "TL", name: "Salz" },
        { id: newId(), amount: 0.5, unit: "TL", name: "Schwarzer Pfeffer" },
        { id: newId(), amount: 1, unit: "Handvoll", name: "Frisches Basilikum" },
      ],
      steps: [
        {
          id: newId(),
          order: 1,
          instruction: "Knoblauch fein hacken und mit 2 EL Olivenöl in einer tiefen Pfanne ca. 1 Minute anschwitzen.",
        },
        {
          id: newId(),
          order: 2,
          instruction: "Gehackte Tomaten und 400 ml Wasser dazugeben und kurz aufkochen lassen.",
        },
        {
          id: newId(),
          order: 3,
          instruction: "Die ungekochte Pasta direkt in die Soße geben. Bei mittlerer Hitze für 10-12 Minuten köcheln lassen und gelegentlich umrühren.",
        },
        {
          id: newId(),
          order: 4,
          instruction: "Mozzarella in Stücke zupfen, unter die heiße Pasta rühren und cremig schmelzen lassen. Mit frischem Basilikum servieren.",
        },
      ],
    },
    {
      title: "Knuspriger Feta-Avocado Toast",
      description: "Der virale Social-Media-Hit: Knuspriges Brot mit cremiger Avocado, Spiegelei und würzigem Feta.",
      servings: 1,
      prepTime: 5,
      cookTime: 5,
      category: "Frühstück",
      favorite: false,
      ingredients: [
        { id: newId(), amount: 2, unit: "Scheiben", name: "Sauerteigbrot" },
        { id: newId(), amount: 1, unit: "Stück", name: "Reife Avocado" },
        { id: newId(), amount: 50, unit: "g", name: "Feta" },
        { id: newId(), amount: 1, unit: "Stück", name: "Ei" },
        { id: newId(), amount: 1, unit: "Prise", name: "Chiliflocken" },
        { id: newId(), amount: 1, unit: "Spritzer", name: "Zitronensaft" },
        { id: newId(), amount: 1, unit: "TL", name: "Olivenöl" },
      ],
      steps: [
        {
          id: newId(),
          order: 1,
          instruction: "Die Brotscheiben in der Pfanne oder im Toaster kross anrösten.",
        },
        {
          id: newId(),
          order: 2,
          instruction: "Avocado mit Zitronensaft, Salz und Pfeffer mit einer Gabel zerdrücken und auf dem Brot verstreichen.",
        },
        {
          id: newId(),
          order: 3,
          instruction: "In einer Pfanne mit etwas Olivenöl ein Spiegelei für 3 Minuten braten, bis der Rand knusprig ist.",
        },
        {
          id: newId(),
          order: 4,
          instruction: "Spiegelei auf das Avocado-Brot legen, Feta darüberbröseln und mit Chiliflocken verfeinern.",
        },
      ],
    },
    {
      title: "Berry Power Protein Smoothie",
      description: "Erfrischender Smoothie voller Antioxidantien und natürlicher Energie. In 3 Minuten gemixt!",
      servings: 1,
      prepTime: 3,
      cookTime: 0,
      category: "Snack",
      favorite: false,
      ingredients: [
        { id: newId(), amount: 150, unit: "g", name: "TK Beerenmischung" },
        { id: newId(), amount: 1, unit: "Stück", name: "Banane" },
        { id: newId(), amount: 200, unit: "ml", name: "Hafermilch" },
        { id: newId(), amount: 1, unit: "EL", name: "Chiasamen" },
        { id: newId(), amount: 1, unit: "EL", name: "Mandelmus" },
      ],
      steps: [
        {
          id: newId(),
          order: 1,
          instruction: "Alle Zutaten zusammen in den Standmixer oder einen hohen Rührbecher geben.",
        },
        {
          id: newId(),
          order: 2,
          instruction: "Auf höchster Stufe für 45-60 Sekunden cremig mixen.",
        },
        {
          id: newId(),
          order: 3,
          instruction: "In ein schönes Glas gießen und direkt eiskalt genießen!",
        },
      ],
    },
  ];
}
