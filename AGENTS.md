# Scroll2Cook – Rezept-Organizer (Local-only MVP)

Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS v4 + Dexie (IndexedDB).
Alle Daten bleiben lokal im Browser. Keine KI, kein Backend-Account.

## Befehle

```bash
npm run dev        # Dev-Server
npm run build      # Production-Build
npm run start      # Produktions-Server
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm run test       # Vitest (Parser-Unit-Tests)
npm run test:e2e   # Playwright E2E (braucht vorher `npm run build`; startet Server auf :3100 selbst)
```

## Architektur

- `src/domain/` – Typen (`Recipe`, `Ingredient`, `RecipeStep`, `ShoppingItem`, `Collection`, `BackupFile`), Kategorien.
- `src/data/` – Repository-Schicht. Die UI nutzt nur `data/index.ts` (`getRecipeRepository()` etc.).
  Konkrete Implementierung: `data/local/*` (Dexie/IndexedDB). Für Supabase später: neue
  Implementierung der Interfaces + Austausch in `data/index.ts`. **Die UI darf Dexie nie direkt importieren.**
- `src/parser/` – heuristischer Rezeptparser (Regex/Scoring, DE+EN, keine KI). Tests: `*.test.ts`.
- `src/lib/` – `scale` (Portionen, nicht-destruktiv), `shoppingMerge`, `image` (Canvas-Kompression),
  `instagram` (URL-Validierung), `text` (IDs, Such-Normalisierung), `collections`
  (welche Rezepte gehören in eine Sammlung), `tags` (nur noch Bestandsdaten, s. u.).
- `src/hooks/` – `useRecipes`, `useRecipe`, `useShoppingList` (Dexie liveQuery), `useImageUrl`
  (löst `local-image:<id>`-Referenzen zu Object-URLs auf).
- `src/app/api/instagram/` – Caption-Abruf: offizielles oEmbed wenn `INSTAGRAM_OEMBED_TOKEN` gesetzt,
  sonst öffentliche og:-Meta-Tags. `image/` = Proxy mit Host-Allowlist (cdninstagram.com, fbcdn.net).

### Preis- und Nährwertermittlung

Auf Wunsch wieder **ausgebaut** (Stand: nach Commit `85e843c`). Der Code liegt lokal
in `PRICE_NUTRITION_ARCHIVE.md` (per .gitignore nicht im Repo) und ist über die
Commits `3f0660e` … `85e843c` jederzeit wiederherstellbar; die wertvollsten
Erkenntnisse aus dem letzten Anlauf stehen dort im Abschnitt „Wiederaktivierung".

### Sammlungen (Ordner) statt Tags

`/collections` gruppiert Rezepte über **eigene Filter** – die Rezepte selbst
werden dafür nicht verschlagwortet:

- Eine Sammlung hat `filter` (Kategorie(n), maximale Gesamtzeit, nur Favoriten,
  Titel enthält, Zutat enthält), `recipeIds` (von Hand hinzugefügt) oder beides;
  es gilt die Vereinigung. `resolveCollectionRecipes` in `src/lib/collections.ts`
  ist die einzige Wahrheit dafür und wird auch von der Rezept-Auswahl
  (`RecipePickerSheet`) genutzt.
- **Die Mitgliedschaft liegt in der Sammlung**, nicht am Rezept → kein Rezept
  braucht eine Migration, ein Rezept darf in beliebig vielen Sammlungen liegen.
- `CollectionFilter` liest alte Felder (`category`, `query`) weiter; neue Regeln
  kommen nur dazu. Unbekannte Felder werden beim Backup-Import verworfen.
- **Tags sind Bestandsdaten**: `Recipe.tags` bleibt, aber es gibt kein
  Eingabefeld mehr und keine Tag-Leiste in der Rezeptliste. `src/lib/tags.ts`
  behält `collectTags`/`matchesTags`, damit alte Bibliotheken und alte
  Tag-Regeln funktionieren.
- Backup **Version 3** enthält `collections`; Version 1 und 2 bleiben lesbar.

## Konventionen

- **Design:** Markenvertrag in [`DESIGN.md`](DESIGN.md), Tokens in `src/app/globals.css`
  (`@theme`). Keine willkürlichen `text-[Npx]`-Werte und kein hartkodiertes
  `bg-white`/`text-black`/`bg-blue-50` – immer Tokens (`text-body`, `bg-surface`,
  `text-ink-2`, `rounded-ctl`, `rounded-card`, `shadow-card`). Eingabefelder bleiben
  bei 16px (iOS zoomt sonst). Zahlen in Listen bekommen `nums` (tabellarische Ziffern).
- **Dark Mode:** läuft **ausschließlich** über die `--color-*`-Variablen. `dark:`-Klassen
  im Markup sind verboten – neue Farben als Token in `globals.css` anlegen und dort für
  `.dark` überschreiben. Die Theme-Wahl (System/Hell/Dunkel) liegt in `src/lib/theme.ts`
  (externer Store, `useSyncExternalStore`), das FOUC-Script in `layout.tsx`.
- **Bedienziele:** mindestens **44 × 44 px** auf dem Handy. Höhen als `min-h-11`
  statt fester `h-*`. Geprüft von `npx playwright test e2e/a11y.spec.ts` (hell + dunkel).
- **Fixierte Leisten:** kein `backdrop-filter`/`filter`/`transform` auf `fixed`/`sticky`
  Elementen oder deren Kindern – das bricht `position: fixed` auf iOS (Leiste scrollt mit).
  Die `glass`-Utility nur auf nicht fixierten Flächen nutzen; die Tab-Leiste ist eine
  schwebende Kapsel mit Pill-Fläche für den aktiven Eintrag.
- Vor Designrunden: `npx playwright test e2e/design-audit.spec.ts` erzeugt Screenshots
  in hell und dunkel (390/1440) unter `e2e/screenshots/design/`.

- Bilder werden als `local-image:<uuid>`-Referenz in `Recipe.image` gespeichert (Blob in Tabelle `images`).
- Mengen-Inputs akzeptieren `1 1/2`, `2,5`, `0.5` → `parseAmountString` aus `src/parser`.
- Deutsche UI-Texte, klare Fehlermeldungen (keine technischen Fehler an User).
- Mobile-first (390×844), Bottom-Nav < md, Top-Nav ≥ md, `prefers-reduced-motion` respektiert.
- Keine neuen Runtime-Dependencies ohne Not.

## Parser-Corpus und Training

Es gibt **zwei** Messlatten; beide werden von `src/parser/corpus.test.ts` bzw. dem
Report-Runner ausgewertet:

- `src/parser/corpus/fixtures/` – **Referenz-Corpus** (18 Fixtures, 7 Creator-Stile).
  Schwellen in `corpus/thresholds.ts` (F1 ≥ 0.97, Schritte ≥ 0.95, Leaks ≤ 1).
- `src/parser/corpus/fixtures-user/` – **eigene Bibliothek** (24 Instagram-Captions
  aus einem Nutzer-Backup, Gruppe `eigene-bibliothek`). Hier gilt `expected` =
  gespeicherte Nutzerfassung, nicht die absolute Wahrheit.

Fixtures aus einem Backup erzeugen:

```bash
node scripts/backup-to-corpus.mjs <pfad/backup.json>            # nach fixtures-user/
node scripts/backup-to-corpus.mjs <pfad/backup.json> --dry      # nur anzeigen
```

Das Skript dokumentiert jede Bereinigung im Feld `notes` und setzt Marker:

- `exclude: "<Grund>"` – Fixture wird **nicht gewertet** (z. B. englische Caption:
  die gespeicherte Fassung ist die übersetzte Anzeige-Fassung und damit keine
  gültige Wahrheit für den Parser, der die Rohfassung liest).
- `stepsUnreliable: "<Grund>"` – die Schrittzahl wird **neutral** bewertet
  (z. B. Caption ohne Anleitung, Schritte von Hand ergänzt).
- Überschriften (`Für den Teig`, `Belag:`) und Werbe-/Code-Zeilen fliegen aus
  `expected`; der Scorer zählt Strukturzeilen auf **beiden** Seiten nicht.

Messen (vitest startet in der Sandbox nicht → mit esbuild bündeln):

```bash
node node_modules/esbuild/bin/esbuild tmp/tools/run-user-corpus.ts \
  --bundle --platform=node --format=cjs --outfile=tmp/tools/run-user-corpus.cjs \
  --tsconfig=tsconfig.json
node tmp/tools/run-user-corpus.cjs     # beide Corpora + Fall-Details
```

Stand nach `PARSER_VERSION` 15: Nutzer-Corpus F1 0.979 (Precision 1.000, Recall
0.962), Titel 95 %, Schritte ±1 86 %; Referenz-Corpus 0.985 (unverändert).

**Zwei gemessene Sackgassen – nicht erneut einbauen** (Werte dokumentiert in der
Commit-Nachricht von `08b33b2`): Zutaten aus Komma-Listen im Anweisungstext
retten (nur Fehlzusätze, F1 −0.008) und lange Prosa-Zeilen satzweise zerlegen
(Über-Segmentierung, Schritte 81 % → 67 %).

### Offen: „neu einlesen" pro Rezept

Aus dem Plan noch **nicht** gebaut (Stand `915a359`). Bereits vorhanden:

- Review markiert unsichere Zutaten sichtbar (`RecipeForm.tsx`, `ing.uncertain`
  → farbiger Rand + Hinweis + Sammelaktionen „unsichere entfernen"/„bestätigen").
- Der Korrektur-Log wird geschrieben (`import/page.tsx` beim Speichern) und in
  den Einstellungen exportiert/gelöscht (`getCorrectionRepository()`).

Fehlt: ein Knopf auf der Rezeptseite, der ein **bestehendes** Rezept mit dem
aktuellen Parser aus `recipe.sourceCaption` neu einliest. Nutzen: künftige
Parser-Verbesserungen wirken sofort, ohne `PARSER_VERSION` zu erhöhen. Achtung:
`parseSnapshot` aus `data/local/parseMerge.ts` nutzen, damit eigene Änderungen
der Nutzer nicht überschrieben werden; Verhalten vorher im Testfall festnageln.

Der Parser-Stand misst sich an: `node tmp/tools/run-user-corpus.cjs`
(Feld-Score + Klassen) und `src/parser/corpus.test.ts` (Schwellen).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
