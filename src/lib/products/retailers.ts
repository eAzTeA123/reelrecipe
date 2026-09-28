import type { RetailerId, RetailerInfo } from "@/domain/productTypes";

/**
 * Deutsche Zielhändler. Es gibt derzeit keinen direkten Händler-Adapter:
 * Preise stammen ausschließlich aus Open Prices (Community-Meldungen) und sind
 * damit lückenhaft und filialbezogen – daher Status "partial".
 */
export const RETAILERS: RetailerInfo[] = [
  { id: "lidl", name: "Lidl", status: "partial" },
  { id: "aldi_sued", name: "Aldi Süd", status: "partial" },
  { id: "aldi_nord", name: "Aldi Nord", status: "partial" },
  { id: "rewe", name: "REWE", status: "partial" },
  { id: "edeka", name: "EDEKA", status: "partial" },
  { id: "kaufland", name: "Kaufland", status: "partial" },
  { id: "penny", name: "Penny", status: "partial" },
  { id: "netto", name: "Netto", status: "partial" },
];

export const RETAILER_NAMES: Record<RetailerId, string> = Object.fromEntries(
  RETAILERS.map((r) => [r.id, r.name]),
) as Record<RetailerId, string>;

/**
 * Ordnet eine OSM-Filiale (Marke/Name) einem Händler zu.
 * Netto ohne Zusatz (Netto City/Netto Marken-Discount) wird als Netto gezählt;
 * "Netto" mit Hund (Nordic) ist in DE sehr selten und wird nicht unterschieden.
 */
export function detectRetailer(brand?: string | null, name?: string | null): RetailerId | undefined {
  const s = `${brand ?? ""} ${name ?? ""}`.toLowerCase();
  if (!s.trim()) return undefined;
  if (/\blidl\b/.test(s)) return "lidl";
  if (/aldi\s*s(ü|ue)d/.test(s)) return "aldi_sued";
  if (/aldi\s*nord/.test(s)) return "aldi_nord";
  if (/\brewe\b/.test(s)) return "rewe";
  if (/\bedeka\b|e-center|marktkauf/.test(s)) return "edeka";
  if (/\bkaufland\b/.test(s)) return "kaufland";
  if (/\bpenny\b/.test(s)) return "penny";
  if (/\bnetto\b/.test(s)) return "netto";
  return undefined;
}
