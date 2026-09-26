import { markerBasedStrategy } from "./markerBased";
import { lineStateMachineStrategy } from "./lineStateMachine";
import { sentenceStateMachineStrategy } from "./sentenceStateMachine";
import type { ParserStrategy, RawParseResult } from "./types";

export const ALL_STRATEGIES: ParserStrategy[] = [
  markerBasedStrategy,
  lineStateMachineStrategy,
  sentenceStateMachineStrategy,
];

export const ensembleStrategy: ParserStrategy = {
  name: "ensemble",
  parse(caption: string): RawParseResult {
    const hasManyLines = (caption.match(/\n/g) || []).length >= 3;

    // 1. Probiere den Fast-Path (Marker-Based)
    const markerRes = markerBasedStrategy.parse(caption);
    if (hasManyLines && markerRes.confidence >= 0.9) {
      return {
        ...markerRes,
        strategy: "ensemble (fast-path: marker_based)",
      };
    }

    // 2. Wenn Zeilenumbrüche vorhanden sind, prüfe Line State Machine
    if (hasManyLines) {
      const lineRes = lineStateMachineStrategy.parse(caption);
      if (lineRes.confidence >= 0.75) {
        return {
          ...lineRes,
          strategy: "ensemble (line_state_machine)",
        };
      }
    }

    // 3. Für Fließtext (z. B. TikTok-Kompression) oder uneindeutige Zeilen: Sentence State Machine
    const sentenceRes = sentenceStateMachineStrategy.parse(caption);
    if (sentenceRes.confidence >= 0.7) {
      return {
        ...sentenceRes,
        strategy: "ensemble (sentence_state_machine)",
      };
    }

    // 4. Fallback auf die Strategie mit der absolut höchsten Konfidenz
    const candidates = [markerRes, sentenceRes];
    if (hasManyLines) candidates.push(lineStateMachineStrategy.parse(caption));

    candidates.sort((a, b) => b.confidence - a.confidence);
    const best = candidates[0];

    return {
      ...best,
      strategy: `ensemble (best-confidence: ${best.strategy})`,
    };
  },
};
