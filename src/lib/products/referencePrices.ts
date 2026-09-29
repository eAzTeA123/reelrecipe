import type { EstimateGroup } from "./categories";

/**
 * Richtwerte je Warengruppe.
 *
 * Sie greifen NUR, wenn Open Prices für eine Zutat weder Produkt- noch
 * Kategoriepreis kennt – vorher blieb so eine Zutat ohne jede Angabe („kein
 * Preis"), was in der Praxis die Mehrheit war. Diese Zahlen sind bewusst
 * konservative, gerundete Richtwerte für deutsche Supermärkte und werden in
 * der UI immer als Schätzung gekennzeichnet, nie als gemeldeter Marktpreis.
 */
export interface ReferencePrice {
  /** Preis in Euro je Bezugseinheit */
  price: number;
  /** kilogram: 1 l wird wie 1 kg behandelt (wässrige Flüssigkeiten) */
  basis: "kilogram" | "unit";
  /** Anzeigename der Warengruppe */
  label: string;
  /** Kurzbegründung für Details/Transparenz */
  note: string;
}

export const ESTIMATE_SOURCE =
  "Richtwert für deutsche Supermärkte – Schätzung, kein gemeldeter Marktpreis";

export const REFERENCE_PRICES: Record<EstimateGroup, ReferencePrice> = {
  gemuese: { price: 2.49, basis: "kilogram", label: "Gemüse", note: "≈ 2,49 €/kg" },
  obst: { price: 2.99, basis: "kilogram", label: "Obst", note: "≈ 2,99 €/kg" },
  kraeuter: { price: 12.9, basis: "kilogram", label: "frische Kräuter", note: "≈ 1,29 € je Bund (20 g)" },
  fleisch: { price: 11.9, basis: "kilogram", label: "Fleisch & Geflügel", note: "≈ 11,90 €/kg" },
  fisch: { price: 14.9, basis: "kilogram", label: "Fisch & Meeresfrüchte", note: "≈ 14,90 €/kg" },
  wurst: { price: 12.9, basis: "kilogram", label: "Wurst & Aufschnitt", note: "≈ 12,90 €/kg" },
  milch: { price: 1.29, basis: "kilogram", label: "Milchprodukte", note: "≈ 1,29 €/l" },
  kaese: { price: 12.9, basis: "kilogram", label: "Käse", note: "≈ 12,90 €/kg" },
  ei: { price: 0.35, basis: "unit", label: "Ei", note: "≈ 0,35 €/Stück" },
  brot: { price: 4.49, basis: "kilogram", label: "Brot & Backwaren", note: "≈ 4,49 €/kg" },
  trockenware: { price: 2.29, basis: "kilogram", label: "Trockenware (Mehl, Reis, Nudeln)", note: "≈ 2,29 €/kg" },
  konserve: { price: 3.49, basis: "kilogram", label: "Konserve", note: "≈ 3,49 €/kg" },
  tiefkuehl: { price: 3.99, basis: "kilogram", label: "Tiefkühlware", note: "≈ 3,99 €/kg" },
  oel: { price: 8.9, basis: "kilogram", label: "Öl", note: "≈ 8,90 €/l" },
  sauce: { price: 8.9, basis: "kilogram", label: "Sauce & Dressing", note: "≈ 8,90 €/l" },
  gewuerz: { price: 29.9, basis: "kilogram", label: "Gewürz", note: "≈ 1,49 € je 50 g" },
  suessware: { price: 9.9, basis: "kilogram", label: "Süßware & Snack", note: "≈ 9,90 €/kg" },
  backzutat: { price: 3.99, basis: "kilogram", label: "Backzutat", note: "≈ 3,99 €/kg" },
  nuss: { price: 14.9, basis: "kilogram", label: "Nüsse & Samen", note: "≈ 14,90 €/kg" },
  getraenk: { price: 1.49, basis: "kilogram", label: "Getränk", note: "≈ 1,49 €/l" },
  ersatz: { price: 19.9, basis: "kilogram", label: "Protein- & Ersatzprodukt", note: "≈ 19,90 €/kg" },
  bruehe: { price: 6.9, basis: "kilogram", label: "Brühe & Fond", note: "≈ 6,90 €/kg" },
  sonstiges: { price: 7.99, basis: "kilogram", label: "Sonstiges", note: "≈ 7,99 €/kg (Markenprodukt ohne Kategorie)" },
};

