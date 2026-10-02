import fs from "node:fs";
import path from "node:path";
import { parse_recipe } from "./index";

export interface FixtureExpected {
  titel?: string;
  zutaten?: string[];
  zubereitung?: string[];
  zeiten?: { prep?: number; cook?: number; total?: number };
  portionen?: number;
  expectedSource?: "site-scraper" | "schema" | "heuristik";
  expectedStatus: "success" | "login_required" | "paywall" | "blocked" | "not_a_recipe" | "fetch_error";
}

export interface BenchmarkMetrics {
  titleAccuracy: number;
  ingredientPrecision: number;
  ingredientRecall: number;
  instructionPrecision: number;
  instructionRecall: number;
  overallScore: number;
}

export interface FixtureResult {
  name: string;
  expectedStatus: string;
  actualStatus: string;
  statusMatch: boolean;
  actualSource?: string;
  expectedSource?: string;
  metrics: BenchmarkMetrics;
  passed: boolean;
  notes?: string;
}

function normalizeString(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\säöüß]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computeListPrecisionRecall(actual: string[], expected: string[]): { precision: number; recall: number } {
  if (expected.length === 0 && actual.length === 0) return { precision: 1, recall: 1 };
  if (expected.length === 0) return { precision: 0, recall: 1 };
  if (actual.length === 0) return { precision: 1, recall: 0 };

  const normActual = actual.map(normalizeString);
  const normExpected = expected.map(normalizeString);

  let truePositives = 0;
  for (const exp of normExpected) {
    // Check if any actual item matches closely
    const match = normActual.some((act) => act.includes(exp) || exp.includes(act));
    if (match) truePositives++;
  }

  const recall = truePositives / expected.length;
  const precision = Math.min(1.0, truePositives / actual.length);

  return { precision, recall };
}

export async function runRecipeBenchmark(): Promise<{ results: FixtureResult[]; summary: string }> {
  const fixturesDir = path.join(process.cwd(), "tests/fixtures/recipes");
  if (!fs.existsSync(fixturesDir)) {
    throw new Error(`Fixtures directory not found: ${fixturesDir}`);
  }

  const dirs = fs.readdirSync(fixturesDir).filter((d) => {
    return fs.statSync(path.join(fixturesDir, d)).isDirectory();
  });

  const results: FixtureResult[] = [];

  for (const dir of dirs) {
    const dirPath = path.join(fixturesDir, dir);
    const htmlPath = path.join(dirPath, "recipe.html");
    const expPath = path.join(dirPath, "expected.json");

    if (!fs.existsSync(htmlPath) || !fs.existsSync(expPath)) continue;

    const html = fs.readFileSync(htmlPath, "utf-8");
    const expected: FixtureExpected = JSON.parse(fs.readFileSync(expPath, "utf-8"));

    // For sites with a dedicated scraper, pass the simulated URL as context
    let parsedRes;
    if (dir === "chefkoch") {
      parsedRes = await parse_recipe(html, "https://www.chefkoch.de/rezepte/123/carbonara.html");
    } else if (dir === "allrecipes") {
      parsedRes = await parse_recipe(html, "https://www.allrecipes.com/recipe/123/pancakes");
    } else if (dir === "bbcgoodfood") {
      parsedRes = await parse_recipe(html, "https://www.bbcgoodfood.com/recipes/classic-scones");
    } else if (dir === "seriouseats") {
      parsedRes = await parse_recipe(html, "https://www.seriouseats.com/crispy-roast-potatoes");
    } else if (dir === "rezeptwelt-flammkuchen") {
      parsedRes = await parse_recipe(
        html,
        "https://www.rezeptwelt.de/backen-herzhaft-rezepte/flammkuchen-knusprig/9exnygje-e2d56-724631-cfcd2-6ylvtrr7",
      );
    } else if (dir === "rezeptwelt") {
      parsedRes = await parse_recipe(
        html,
        "https://www.rezeptwelt.de/hauptgerichte-mit-gemuese-rezepte/spinat-risotto/899ild5b-c6243-476130-cfcd2-he8bv9kb",
      );
    } else {
      parsedRes = await parse_recipe(html);
    }

    const actualStatus = parsedRes.status;
    const statusMatch = actualStatus === expected.expectedStatus;

    let metrics: BenchmarkMetrics = {
      titleAccuracy: 0,
      ingredientPrecision: 0,
      ingredientRecall: 0,
      instructionPrecision: 0,
      instructionRecall: 0,
      overallScore: 0,
    };

    let passed = false;
    let actualSource = undefined;

    if (expected.expectedStatus !== "success") {
      passed = statusMatch;
      metrics = {
        titleAccuracy: passed ? 1 : 0,
        ingredientPrecision: passed ? 1 : 0,
        ingredientRecall: passed ? 1 : 0,
        instructionPrecision: passed ? 1 : 0,
        instructionRecall: passed ? 1 : 0,
        overallScore: passed ? 1 : 0,
      };
    } else if (parsedRes.recipe) {
      const rec = parsedRes.recipe;
      actualSource = rec.zutaten.source;

      // Title
      const titleMatch = expected.titel
        ? normalizeString(rec.titel.value).includes(normalizeString(expected.titel)) ||
          normalizeString(expected.titel).includes(normalizeString(rec.titel.value))
        : true;
      metrics.titleAccuracy = titleMatch ? 1 : 0.5;

      // Ingredients
      if (expected.zutaten) {
        const pr = computeListPrecisionRecall(rec.zutaten.value, expected.zutaten);
        metrics.ingredientPrecision = pr.precision;
        metrics.ingredientRecall = pr.recall;
      } else {
        metrics.ingredientPrecision = 1;
        metrics.ingredientRecall = 1;
      }

      // Instructions
      if (expected.zubereitung) {
        const pr = computeListPrecisionRecall(rec.zubereitung.value, expected.zubereitung);
        metrics.instructionPrecision = pr.precision;
        metrics.instructionRecall = pr.recall;
      } else {
        metrics.instructionPrecision = 1;
        metrics.instructionRecall = 1;
      }

      metrics.overallScore = parseFloat(
        (
          metrics.titleAccuracy * 0.2 +
          metrics.ingredientRecall * 0.4 +
          metrics.instructionRecall * 0.4
        ).toFixed(2)
      );

      passed = statusMatch && metrics.overallScore >= 0.70;
    }

    results.push({
      name: dir,
      expectedStatus: expected.expectedStatus,
      actualStatus,
      statusMatch,
      actualSource,
      expectedSource: expected.expectedSource,
      metrics,
      passed,
    });
  }

  // Generate table summary
  const rows: string[] = [];
  rows.push("\n================================================================================");
  rows.push("RECIPE PARSER BENCHMARK RESULTS (MULTI-SITE TEST MATRIX)");
  rows.push("================================================================================");
  rows.push(
    "Website".padEnd(18) +
    "Status".padEnd(15) +
    "Source".padEnd(14) +
    "Ing Recall".padEnd(13) +
    "Step Recall".padEnd(13) +
    "Score".padEnd(10) +
    "Verdict"
  );
  rows.push("-".repeat(84));

  let passCount = 0;
  let warnCount = 0;
  let blockedCount = 0;

  for (const r of results) {
    const verdict = r.passed
      ? r.metrics.overallScore < 0.85 && r.expectedStatus === "success"
        ? "WARN"
        : r.expectedStatus !== "success"
        ? "BLOCKED/HANDLED"
        : "PASS"
      : "FAIL";

    if (verdict === "PASS") passCount++;
    else if (verdict === "WARN") warnCount++;
    else if (verdict === "BLOCKED/HANDLED") blockedCount++;

    rows.push(
      r.name.padEnd(18) +
      r.actualStatus.padEnd(15) +
      (r.actualSource || "-").padEnd(14) +
      `${Math.round(r.metrics.ingredientRecall * 100)}%`.padEnd(13) +
      `${Math.round(r.metrics.instructionRecall * 100)}%`.padEnd(13) +
      `${Math.round(r.metrics.overallScore * 100)}%`.padEnd(10) +
      verdict
    );
  }

  rows.push("-".repeat(84));
  rows.push(`Total Fixtures: ${results.length} | PASS: ${passCount} | WARN: ${warnCount} | BLOCKED/HANDLED: ${blockedCount}`);
  rows.push("================================================================================\n");

  const summary = rows.join("\n");
  return { results, summary };
}
