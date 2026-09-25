/** Portionen-Skalierung: verändert niemals die gespeicherten Originalwerte. */
export function scaleAmount(
  amount: number | undefined,
  originalServings: number | undefined,
  targetServings: number,
): number | undefined {
  if (amount === undefined) return undefined;
  if (!originalServings || originalServings <= 0) return amount;
  return amount * (targetServings / originalServings);
}

const FRACTIONS: [number, string][] = [
  [0.125, "⅛"], [0.25, "¼"], [0.333, "⅓"], [0.5, "½"],
  [0.666, "⅔"], [0.75, "¾"],
];

function formatNumber(value: number): string {
  if (value === 0) return "0";
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.001) return String(rounded);

  const whole = Math.floor(value);
  const frac = value - whole;
  for (const [f, sym] of FRACTIONS) {
    if (Math.abs(frac - f) < 0.015) {
      return whole > 0 ? `${whole} ${sym}` : sym;
    }
  }
  // Bei sehr kleinen Zahlen (< 0.1) mindestens 2 Dezimalstellen
  if (value < 0.1) {
    const twoDecimals = Math.round(value * 100) / 100;
    if (twoDecimals > 0) return String(twoDecimals).replace(".", ",");
  }
  // sinnvolle Rundung: 1 Dezimalstelle
  const oneDecimal = Math.round(value * 10) / 10;
  return String(oneDecimal).replace(".", ",");
}

/** Formatiert Menge + Einheit schön ("1000 g", "1,5 l", "½"). */
export function formatAmount(amount: number | undefined, unit?: string): string {
  if (amount === undefined) return unit ?? "";
  // in größere Einheit umrechnen, wenn sinnvoll
  let a = amount;
  let u = unit;
  if (u) {
    const lu = u.toLowerCase();
    if (lu === "g" && a >= 1000 && a % 250 < 10) { a = a / 1000; u = "kg"; }
    else if (lu === "ml" && a >= 1000 && a % 250 < 10) { a = a / 1000; u = "l"; }
  }
  const formatted = formatNumber(a);
  return u ? `${formatted} ${u}` : formatted;
}
