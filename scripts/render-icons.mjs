/**
 * Erzeugt alle Raster-Icons aus `src/app/icon.svg`.
 *
 * Warum über den Browser: Chromium rendert SVG mit korrekter Kantenglättung.
 * Damit brauchen wir weder Bildeditor noch zusätzliche Abhängigkeit – Playwright
 * ist ohnehin als Entwicklungsabhängigkeit vorhanden.
 *
 * Warum über eine Canvas und nicht über `page.screenshot()`: Screenshots eines
 * deckenden Inhalts liefern **RGB**-PNGs. Next.js dekodiert `favicon.ico` beim
 * Build und bricht dort mit „The PNG is not in RGBA format!" ab. Eine Canvas
 * schreibt immer RGBA.
 *
 * Aufruf:  node scripts/render-icons.mjs
 *
 * Ergebnis:
 *   public/icon-512.png            („any", randlos)
 *   public/icon-1024.png           (randlos)
 *   public/icon-512-maskable.png   (Zeichnung auf 86 % verkleinert, damit
 *                                   aggressive Launcher-Masken nichts anschneiden)
 *   src/app/apple-icon.png         (180 px, randlos – iOS rundet selbst)
 *   src/app/favicon.ico            (16/32/48 als PNG-Einträge)
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "src/app/icon.svg"), "utf8");

/**
 * Skaliert die Zeichnung um den Mittelpunkt (512, 512) – als SVG-Attribut, nicht
 * als CSS, damit die Skalierung beim Serialisieren erhalten bleibt.
 */
function artAt(scale) {
  if (scale === 1) return svg;
  const offset = 512 * (1 - scale);
  return svg.replace(
    '<g id="art">',
    `<g id="art" transform="translate(${offset} ${offset}) scale(${scale})">`,
  );
}

/**
 * Zeichnet die Marke in der gewünschten Größe.
 *
 * `inset` verkleinert die gesamte Zeichnung minimal und lässt einen
 * transparenten Rand stehen. Das ist für `favicon.ico` nötig: Chromium schreibt
 * ein RGB-PNG, wenn **alle** Pixel deckend sind, und Next.js lehnt das beim
 * Dekodieren des ICO ab („The PNG is not in RGBA format!"). Bei 16 px ist der
 * Rand nicht zu sehen.
 */
async function renderPng(page, size, { scale = 1, inset = 0 } = {}) {
  const drawn = size * (1 - inset);
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;background:transparent}
      svg{display:block;width:${drawn}px;height:${drawn}px}
    </style></head><body>${artAt(scale)}</body></html>`,
  );

  return page.screenshot({ type: "png", omitBackground: true });
}

/** Packt PNG-Puffer in einen .ico-Container (PNG-Einträge, seit Vista üblich). */
function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserviert
  header.writeUInt16LE(1, 2); // Typ: Icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, data } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // 0 bedeutet 256
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2); // Farbanzahl
    entry.writeUInt8(0, 3); // reserviert
    entry.writeUInt16LE(1, 4); // Ebenen
    entry.writeUInt16LE(32, 6); // Bit pro Pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const targets = [
  { file: "public/icon-512.png", size: 512 },
  { file: "public/icon-1024.png", size: 1024 },
  { file: "public/icon-512-maskable.png", size: 512, scale: 0.86 },
  { file: "src/app/apple-icon.png", size: 180 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

for (const target of targets) {
  const buffer = await renderPng(page, target.size, { scale: target.scale ?? 1 });
  writeFileSync(resolve(root, target.file), buffer);
  console.log(
    `  ${target.file}  ${target.size}×${target.size}  ${(buffer.length / 1024).toFixed(1)} KB`,
  );
}

const icoImages = [];
for (const size of [16, 32, 48]) {
  icoImages.push({ size, data: await renderPng(page, size, { inset: 0.02 }) });
}
const ico = buildIco(icoImages);
writeFileSync(resolve(root, "src/app/favicon.ico"), ico);
console.log(`  src/app/favicon.ico  16/32/48  ${(ico.length / 1024).toFixed(1)} KB`);

await browser.close();
