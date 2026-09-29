import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { CorpusFixture } from "./types";

export const CORPUS_DIR = join(process.cwd(), "src", "parser", "corpus", "fixtures");

function validate(fixture: CorpusFixture, file: string): CorpusFixture {
  if (!fixture.id) fixture.id = file.replace(/\.json$/, "");
  if (!fixture.caption || typeof fixture.caption !== "string") {
    throw new Error(`Corpus-Fixture ${file} hat keine caption`);
  }
  if (!fixture.expected?.ingredients || typeof fixture.expected.stepsCount !== "number") {
    throw new Error(`Corpus-Fixture ${file} hat keine gültige expected-Sektion`);
  }
  return fixture;
}

/**
 * Lädt alle Corpus-Fixtures (alphabetisch nach Dateiname, damit die Ausgabe stabil ist).
 * Eine Datei darf ein einzelnes Fixture oder ein Array von Fixtures enthalten
 * (so kommt der Export aus dem App-Korrektur-Log an).
 */
export function loadCorpus(dir: string = CORPUS_DIR): CorpusFixture[] {
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  const fixtures: CorpusFixture[] = [];
  for (const file of files) {
    const raw = readFileSync(join(dir, file), "utf-8");
    const parsed = JSON.parse(raw) as CorpusFixture | CorpusFixture[];
    const list = Array.isArray(parsed) ? parsed : [parsed];
    for (const entry of list) fixtures.push(validate(entry, file));
  }
  return fixtures;
}
