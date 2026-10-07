/**
 * Token-Verbrauch aller Sitzungen dieses Projekts auswerten (Vorher/Nachher).
 *
 * Quelle: ~/.dsh/storages/session_projcache/sessions/*.json
 *   record.identity.cwd                     → Projektzuordnung
 *   record.rows.tokenUsage.val.totals       → Zähler der Sitzung
 *
 * Aufruf: node tmp/tools/token-report.mjs [projektpfad]
 */
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const project = process.argv[2] ?? process.cwd();
const dir = join(homedir(), ".dsh", "storages", "session_projcache", "sessions");

const rows = [];
for (const file of readdirSync(dir)) {
  if (!file.endsWith(".json")) continue;
  let data;
  try {
    data = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch {
    continue;
  }
  const record = data?.record;
  const cwd = record?.identity?.cwd;
  if (!cwd || cwd.toLowerCase() !== project.toLowerCase()) continue;

  const usage = record?.rows?.tokenUsage?.val;
  const totals = usage?.totals ?? {};
  const pressure = record?.rows?.contextPressure?.val ?? {};
  rows.push({
    id: file.replace(".json", ""),
    createdAt: record.identity.createdAt ?? 0,
    title: (record.rows?.title?.val ?? "").slice(0, 46),
    output: totals.outputTokens ?? 0,
    input: totals.uncachedInputTokens ?? 0,
    cacheRead: totals.cacheReadTokens ?? 0,
    surface: pressure.surfaceTokens ?? 0,
  });
}

rows.sort((a, b) => a.createdAt - b.createdAt);

const num = (value) => value.toLocaleString("de-DE");
console.log(`Sitzungen dieses Projekts: ${rows.length}\n`);
console.log("Datum      Ausgabe   Eingabe   Cache-Read   Prompt   Titel");
for (const row of rows) {
  const date = new Date(row.createdAt).toISOString().slice(0, 16).replace("T", " ");
  console.log(
    `${date}  ${String(num(row.output)).padStart(8)}  ${String(num(row.input)).padStart(8)}  ` +
      `${String(num(row.cacheRead)).padStart(10)}  ${String(num(row.surface)).padStart(7)}   ${row.title}`,
  );
}

const outputs = rows.map((row) => row.output).filter((value) => value > 0);
outputs.sort((a, b) => a - b);
const sum = outputs.reduce((a, b) => a + b, 0);
const median = outputs.length ? outputs[Math.floor(outputs.length / 2)] : 0;
console.log(
  `\nAusgabe-Tokens: Summe ${num(sum)} · Mittel ${num(Math.round(sum / (outputs.length || 1)))} · ` +
    `Median ${num(median)} · größte ${num(outputs[outputs.length - 1] ?? 0)}`,
);
const inputs = rows.reduce((a, b) => a + b.input + b.cacheRead, 0);
console.log(`Eingabe+Cache gesamt: ${num(inputs)}  (Verhältnis Ausgabe zu Eingabe 1 : ${(inputs / (sum || 1)).toFixed(1)})`);
