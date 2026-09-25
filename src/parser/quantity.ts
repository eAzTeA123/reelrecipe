// Mengen: 1 | 10 | 0.5 | 1,5 | 2,5 | 1/2 | 1/4 | 3/4 | 1 1/2 | 2-3
const NUMBER = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+[.,]\d+|\d+)`;
const RANGE = String.raw`(?:${NUMBER})\s*(?:-|–|bis|to)\s*(?:${NUMBER})`;

export const AMOUNT_REGEX = new RegExp(`^(?:${RANGE}|${NUMBER})(?=\\s|$|[^\\d])`, "u");
const RANGE_MATCH_REGEX = new RegExp(`^(${NUMBER})\\s*(?:-|–|bis|to)\\s*(${NUMBER})$`, "u");

const WORD_NUMBERS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, einem: 1, einer: 1,
  zwei: 2, zwo: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8,
  neun: 9, zehn: 10, elf: 11, zwölf: 12, zwoelf: 12,
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12,
  half: 0.5, halbe: 0.5, halben: 0.5, halbes: 0.5, halber: 0.5,
};

export function parseAmountString(raw: string): number | undefined {
  const s = raw.trim();
  const rangeMatch = s.match(RANGE_MATCH_REGEX);
  if (rangeMatch) {
    const a = parseAmountString(rangeMatch[1]);
    const b = parseAmountString(rangeMatch[2]);
    if (a !== undefined && b !== undefined) return Math.round(((a + b) / 2) * 4) / 4;
    return a;
  }
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) {
    const denom = parseInt(mixed[3], 10);
    if (denom === 0) return undefined;
    return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / denom;
  }
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) {
    const denom = parseInt(frac[2], 10);
    if (denom === 0) return undefined;
    return parseInt(frac[1], 10) / denom;
  }
  const dec = s.match(/^(\d+)[.,](\d+)$/);
  if (dec) return parseFloat(`${dec[1]}.${dec[2]}`);
  const int = s.match(/^\d+$/);
  if (int) return parseInt(s, 10);
  return undefined;
}

export function wordToNumber(word: string): number | undefined {
  return WORD_NUMBERS[word.toLowerCase()];
}
