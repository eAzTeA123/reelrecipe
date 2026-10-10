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

**Leistungsurteile nur gegen den Produktions-Build.** `next dev` kompiliert jede
Route beim ersten Aufruf neu; Navigationen dauern dadurch Sekunden und sehen wie
Bedienfehler aus („ich muss mehrmals tippen"). Gemessen mit
`npx playwright test e2e/perf.spec.ts` – die Spec legt 120 Rezepte an und
protokolliert Liste, Scroll-Last und Tab-Wechsel gegen `next start`. Stand:
erste Karte 0,2 s, Tippen→Detail 0,2 s, Tab-Wechsel 0,07–0,24 s, keine
langlaufenden Aufgaben beim Scrollen.

Große Bibliotheken misst `npx playwright test e2e/perf-scale.spec.ts`
(120/400/800 Rezepte, zusätzlich Wochenplan): erste Karte bei 800 Rezepten
0,26 s. Möglich machen das `useProgressiveList` (Listen rendern in 48er-Scheiben)
und `.card-lazy` (`content-visibility: auto`), siehe `globals.css`. Vorher baute
React alle Karten in einem Zug auf: 8,2 s bis zur ersten Karte, 19 093 DOM-Knoten
und 286 s Hauptthread-Arbeit beim Scrollen.

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

Stand nach `PARSER_VERSION` 25: Nutzer-Corpus F1 0.971 (Precision 0.995, Recall
0.950), Titel 95 %, Schritte ±1 86 %; Referenz-Corpus 0.976 (Schwelle 0.97 hält).
Der Nutzerwert liegt unter 23 (0.978), weil der Korpus den **gespeicherten**
Bestand als Wahrheit führt und dort Artefakte stehen, die jetzt korrekt entfallen
(„Wasser ausspülen", „Fleischfüllung", „Sonstiges").

Neu in 25 (zweite Runde der redaktionellen Prüfung, offene Punkte aus 24):

- **Nummerierte Anweisungen sind unantastbar**: In `markerBased` fielen „1️⃣ Ofen
  auf 190 °C vorheizen", „2️⃣ Hähnchen … würfeln" und „7️⃣ Servieren & genießen"
  durch die Überschriften-/Lead-in-Prüfungen – das Rezept hatte 5 statt 7 Schritte.
  Pfeil-Fortsetzungen („➡️ 45 Min abgedeckt") und kurze Zeitangaben werden jetzt an
  den Schritt darüber gehängt statt eigenen Schritt zu werden.
- **Strukturzeilen sind keine Schritte** (jetzt dort geprüft, wo der
  Abschnittskontext bekannt ist, nicht in `makeSteps`): Abschnitts-Überschriften,
  Etiketten, reine Ofenangaben und Nährwertzeilen wandern nach `other`. Eine
  Ofenangabe **mit** Handlungsverb bleibt Schritt.
- **Kurze Komma-Aufzählungen** werden geteilt („Salz, Pfeffer" war ein Eintrag und
  verlor das Komma).
- **Klammer-Listen bleiben zusammen** („Gewürze (Paprika, Knoblauch, Salz &
  Pfeffer)" zerfiel in Bruchstücke); ein Klammer-Zusatz am Namensende wird zur
  Notiz (`toIngredient`).

**Weiter offen** (aus den sechs Lektoratsberichten, noch nicht gebaut): Titel aus
Caption-Fragmenten („Marie", „Handvoll Cherry Tomaten", „Pasta nach Wahl");
Zutaten, die nur im Anleitungstext stehen (Nutella in 1, 40 g Joghurt in 6, 28 g
Pudding Mix in 38); eine Zutatenzeile, die als Schritt 1 landet (12); doppelte
Gruppenläufe bei wiederholten Überschriften (9, 41, 45); abgeschnittene
Marken-Zutaten mit Klammerzusatz („Daily Blend" → „Daily", 34).

**Zwei gemessene Sackgassen – nicht erneut einbauen** (Werte dokumentiert in der
Commit-Nachricht von `08b33b2`): Zutaten aus Komma-Listen im Anweisungstext
retten (nur Fehlzusätze, F1 −0.008) und lange Prosa-Zeilen satzweise zerlegen
(Über-Segmentierung, Schritte 81 % → 67 %).

**Dritte gemessene Sackgasse (25):** Zutatenzeilen mit mehreren Mengen in einer
Zeile („250g chicken breast, diced 20g tikka paste 1 tsp purée 40g yoghurt") über
einen Trennpunkt vor jeder Zahl aufzuspalten. Der Ausdruck trifft auch normale
Zeilen: „1 1/2 EL" zerfiel in „1" und „1/2 EL". Gemessen: Nutzer-Corpus F1 0.971
→ 0.951, Mengen 99 % → 89 %. Rückgängig gemacht. Wer das erneut versucht, muss
zuerst Unicode-Brüche und gemischte Zahlen schützen (Tests:
`parseIngredientLine > behält Dezimalkommas und gemischte Unicode-Brüche`,
`parseRecipe – Deutsch > erkennt alle Zutaten mit Mengen`).

Ebenfalls versucht und verworfen: eine Titelprüfung gegen Begrüßungen und
Anleitungssätze direkt nach der Titelwahl – sie griff nicht, weil der
Marketing-Headline-Block danach den Titel erneut setzt; der Fall „Hallo meine
Lieben" blieb Titel. Vor einem neuen Versuch dort ansetzen, nicht am Ende.

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

## Arbeiten ohne Token zu verbrennen

Gemessen über 16 Sitzungen dieses Projekts (`node scripts/token-report.mjs`):
**Eingabe/Kontext 915 M Tokens gegen 2,5 M Ausgabe – Verhältnis 1 : 359.** Wer
sparen will, muss also am Kontext arbeiten, nicht an der Wortzahl. Die Regeln
gelten für Agenten wie für Menschen:

**Ausgabe knapp halten** (die billigste Schicht, kostet keine Qualität):
- Ergebnis zuerst, dann Begründung. Keine Einleitungen, keine Wiederholung der
  Frage, keine Zusammenfassung des gerade Gesagten.
- Tabellen und Stichpunkte statt Fließtext; keine Aufzählung von Schritten, die
  schon im Diff oder in der Ausgabe stehen.
- **Unverkürzt bleiben**: Code, Befehle, Messwerte, Testresultate, Fehlermeldungen,
  Risiken und Begründungen. Knappheit darf keine Zahl und keine Warnung kosten.
- Deutsch bleibt Deutsch, inklusive Umlauten.

**Kontext klein halten** (der eigentliche Hebel):
- Dateien gezielt lesen: `grep` vor `read`, `read` mit `offset`/`limit` statt
  ganzer Dateien, keine Datei zweimal lesen.
- Befehlsausgaben begrenzen (`Select-Object -First/-Last`, gezielte Filter) –
  eine Ausgabe wird bei jeder weiteren Anfrage erneut mitgeschickt.
- Breite Erkundung an einen Subagenten geben (`subagent`): Dessen Werkzeugausgaben
  bleiben in seinem Kontext, nicht im Hauptstrang.
- Lange Sitzungen abschließen statt endlos weiterführen: Stand in die
  Commit-Nachricht oder eine `HANDOFF.md`, dann in einer neuen Sitzung weiter.
  Der Kontext wird bei jedem Schritt erneut gelesen – kurze Sitzungen sind der
  größte Einzelhebel.
- DSH komprimiert den Kontext selbst (Checkpoints); darauf verlassen statt
  vorsorglich alles im Kopf zu behalten.

**Messen statt glauben**: `node scripts/token-report.mjs` zeigt je Sitzung
Ausgabe-, Eingabe- und Cache-Tokens sowie das Verhältnis. Nach einigen Sitzungen
erneut laufen lassen und vergleichen – nicht schätzen.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
