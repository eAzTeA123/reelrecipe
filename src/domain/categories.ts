export const CATEGORIES = [
  "Frühstück",
  "Mittagessen",
  "Abendessen",
  "Dessert",
  "Meal Prep",
  "High Protein",
  "Pasta",
  "Sonstiges",
] as const;

export type Category = (typeof CATEGORIES)[number];
