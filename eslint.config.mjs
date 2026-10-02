import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "e2e/**",
    // Arbeitsverzeichnis für Messungen (gebündelte Prüfskripte, gitignoriert).
    // Ohne diesen Eintrag lintet `eslint .` die ~70 000 Zeilen der Bündel.
    "tmp/**",
  ]),
]);
