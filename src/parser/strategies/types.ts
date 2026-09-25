export interface RawParseResult {
  title: string;
  ingredients: string[];
  steps: string[];
  other: string[];
  confidence: number;
  strategy: string;
}

export interface ParserStrategy {
  name: string;
  parse(caption: string): RawParseResult;
}
