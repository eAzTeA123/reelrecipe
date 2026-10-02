/**
 * Führt das Golden-Set-Eval aus: erst bündeln, dann messen.
 *
 * Warum nicht Vitest: Vitest lädt seine TypeScript-Konfiguration über einen
 * esbuild-Dienst mit gepipten Standardströmen. In eingeschränkten Umgebungen
 * (hier: DSH-Sandbox) scheitert das mit `spawn EPERM`, und das Eval wäre nicht
 * ausführbar. Dasselbe gilt für esbuilds **JS-API** – deshalb wird hier die
 * esbuild-**Kommandozeile** als eigener Prozess gestartet, und zwar mit
 * `stdio: "inherit"`: gepipte Ströme sind in der Sandbox gesperrt, vererbte
 * nicht. Das ist genau das Muster, das AGENTS.md für die Corpus-Messung nennt.
 *
 * Aufrufe:
 *   npm run eval         → nur Dev-Set (Tuning)
 *   npm run eval:final   → Dev + Test, einmalig, wird protokolliert
 *   npm run eval:live    → zusätzlich echte Quellen abfragen (Phase 4)
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const flags = process.argv.slice(2);
const bundlePath = join(root, "tmp", "eval-price.bundle.mjs");
mkdirSync(join(root, "tmp"), { recursive: true });

const esbuildBin = join(root, "node_modules", "esbuild", "bin", "esbuild");
const bundleArgs = [
  esbuildBin,
  join(root, "tests", "golden", "eval.ts"),
  "--bundle",
  "--platform=node",
  "--format=esm",
  "--target=node20",
  `--outfile=${bundlePath}`,
  `--tsconfig=${join(root, "tsconfig.json")}`,
  `--alias:@=${join(root, "src")}`,
  "--log-level=warning",
];

const bundled = spawnSync(process.execPath, bundleArgs, { stdio: "inherit", cwd: root });
if (bundled.status !== 0) {
  console.error("Bündeln fehlgeschlagen (esbuild).");
  process.exit(bundled.status ?? 1);
}

const measured = spawnSync(process.execPath, [bundlePath, ...flags], { stdio: "inherit", cwd: root });
process.exit(measured.status ?? 1);
