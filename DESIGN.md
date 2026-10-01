# Scroll2Cook – Design-System

Markenvertrag für die Oberfläche. Wer Farben, Schrift, Radien oder Schatten
ändert, ändert sie **hier** und in `src/app/globals.css` (`@theme`) – nicht in
einzelnen Komponenten. Alles andere findet die Tokens automatisch.

## Idee

Ein persönliches Kochbuch, kein Dashboard – mit Apple-Anmutung: viel Weißraum,
klare Hierarchie, präzise Typografie, freundlich-verspielte Rückmeldungen.
Warmes Papier bleibt der Grundton, ein sattes Terrakotta ist der **einzige**
Akzent, Serif-Überschriften geben Buchtitel-Charakter, und die einzige
Bildsprache sind die eigenen Rezeptfotos. Keine Stockfotos, keine
Dekorationsverläufe, keine zweite Markenfarbe, kein Lila.

## Farbe

Zwei Ebenen: `:root` trägt die hellen Werte, Dark Mode **überschreibt dieselben
`--color-*`-Variablen** (Systemeinstellung über `prefers-color-scheme`,
ausdrückliche Wahl über `data-theme` am `<html>`). Dadurch folgt jede Utility
automatisch – `dark:`-Klassen im Markup sind verboten.

| Token | Hell | Dunkel | Rolle |
| --- | --- | --- | --- |
| `--color-bg` | `#faf7f2` | `#131110` | Papier – Seitenhintergrund |
| `--color-surface` | `#ffffff` | `#1c1917` | Karten, Panels, Sheets |
| `--color-surface-2` | `#f3eee7` | `#241f1c` | Chips, Sekundärflächen, Skeleton |
| `--color-surface-3` | `#eae4da` | `#2d2723` | Vertiefungen, Wells, Hover auf Flächen |
| `--color-ink` | `#1b1815` | `#f6f2ee` | Text (nie `#000`) |
| `--color-ink-2` | `#5c544c` | `#b3aaa1` | Sekundärtext |
| `--color-ink-3` | `#7b7268` | `#8b8177` | Kleinste Schrift – hält ≥ 4.5:1 |
| `--color-line` | `#e8e1d6` | `#302a26` | Ränder, Trenner |
| `--color-line-2` | `#d8d0c2` | `#423a35` | Betonte Ränder, Hover |
| `--color-accent` | `#e0563a` | `#ff7a58` | **Der** Akzent (Sättigung ~73 %) |
| `--color-accent-hover` | `#c9482e` | `#ff9174` | Akzent im Hover |
| `--color-accent-soft` | `#fdeee7` | `#3a2119` | Akzentfläche (Hinweise, Badges) |
| `--color-accent-ink` | `#fffaf7` | `#1a0f0a` | Text auf Akzent |
| `--color-good` | `#3d8b5f` | `#62c68d` | Erfolg, „passt" |
| `--color-warn` | `#c08420` | `#e0b45c` | Unsicher, teilweise |
| `--color-danger` | `#d24b3f` | `#ff6f61` | Löschen, Fehler |
| `--glass` | `rgba(255,255,255,.72)` | `rgba(28,25,23,.72)` | Schwebeleisten (Nav, Sticky, Toast) |
| `--wash-1/2` | Akzent-/Ocker-Schleier | verstärkt | Papier-Wäsche für Cover |

**Regeln:** Grautöne immer warm (nie Zink/Neutral-Kalt), Akzent-Sättigung
< 80 %, genau **ein** Akzent, Schatten warm getönt und von oben beleuchtet.

## Schrift

Maximal zwei Schriften, beide über `next/font` mit `display: swap`, Subset latin.

- **Display: Fraunces** (`font-display`, `--font-display`) – Seiten- und
  Kartentitel, Wortmarke, große Zahlen. Nur Gewicht 400: Größe erzeugt Wirkung,
  nicht Fettung.
- **UI/Text: Figtree** (`--font-sans`) – alles andere.

| Token | Größe | Einsatz |
| --- | --- | --- |
| `text-display` | `clamp(2.75rem, 8vw, 4.5rem)` | Kochbuch-Cover |
| `text-title` | `clamp(1.625rem, 5.5vw, 2.5rem)` | Seitentitel (`PageHeader`) |
| `text-h1` | `clamp(1.5rem, 4.5vw, 2rem)` | Abschnittstitel, leere Zustände |
| `text-h2` | 21px | Untertitel, Settings-Abschnitte, Cover-Fallback |
| `text-card` | 21px | Kartentitel (Serif) |
| `text-h3` | 17px | Fließtext-Betonung |
| `text-body` | 15px | Standardtext |
| `text-meta` | 13px | Hinweise, Meta-Zeilen, Labels in Formularen |
| `text-label` | 12px | Eyebrows, Badges, Kleinstschrift |

**Regeln:** keine willkürlichen `text-[Npx]`-Werte – fehlt eine Größe, kommt sie
als Token dazu. Eingabefelder bleiben bei **16 px** (iOS zoomt sonst). Zahlen in
Listen bekommen `nums` (tabellarische Ziffern). Großbuchstaben nur als Eyebrow.

## Raster und Abstände

4-px-Basis (4/8/12/16/20/24/32/40/56/72/96); Container `max-w-[1120px]`,
Gutter 20 px mobil / 32 px ab md; Sektionen `gap-y-10` → `gap-y-16`; Lesebreite
max. 62 ch; Kartenraster 1 / 2 (sm) / 3 (lg) / 4 (xl) mit `gap-x-5 gap-y-9`.

## Form und Tiefe

| Token | Wert | Einsatz |
| --- | --- | --- |
| `--radius-xs` | 10px | Badges, Thumb im Segment-Umschalter |
| `--radius-ctl` | 14px | Buttons, Inputs, Chips |
| `--radius-card` | 22px | Karten, Panels |
| `--radius-frame` | 26px | Medien, Cover, Symbolläche |
| `--radius-sheet` | 28px | Sheets, Dialoge |
| `--radius-pill` | 999px | Pills, Icon-Buttons, Herz |

Regel: innen = außen − Abstand (z. B. Thumb 10 px in einer 14-px-Kapsel mit
4 px Innenabstand).

| Schatten | Einsatz |
| --- | --- |
| `--shadow-card` | ruhende Flächen auf dem Papier (im Dark Mode eine feine Innenkante) |
| `--shadow-lift` | Anhebung bei Hover (`.card-hover`) |
| `--shadow-pop` | Schwebendes: Dialog, Sheet, Toast, Segment-Thumb |

**Glas** (`glass`) nur kleinflächig und nur dort, wo die Seite dahinter
sichtbar bleibt: Navigation, schwebende Aktionsleiste, Toast. Nie auf Flächen,
die über einem dunklen Overlay liegen (Sheets bleiben opak – sonst wird Weiß
über Schwarz zu Grau).

## Bewegung

Nur `transform` und `opacity` animieren (`backdrop-filter` sparsam).
Dauern: 140 ms Tap · 200 ms Zustand · 320 ms Eintritt · 420 ms Sheet.
Kurven: `--ease-out` `cubic-bezier(.22,.61,.36,1)` für Eintritte,
`--ease-spring` `cubic-bezier(.34,1.56,.64,1)` für Druck und Federn,
`--ease-in` für Exits. Staffelung 40 ms, höchstens 6 Elemente.

Rückmeldungen: `.pressable` (aktiv `scale(0.97)`), `.card-hover` (Desktop-Hover),
`.tick-pop`, `input:checked ~ .tick-box` (Abhaken in der Einkaufsliste),
`.check-draw` (Häkchen zeichnet sich), Haptik über `useHaptic` beim Abhaken.

`prefers-reduced-motion` schaltet **jede** Animation ab (Opacity ≤ 120 ms);
neue Bewegung muss dort ebenfalls aus sein.

## Ladezustände

- **Extraktion:** `ExtractionLoader` – „Topf mit Dampf" (reines CSS, ein Element
  plus drei Dampfstreifen), optional mit Fortschrittsbalken (`progress`, nur
  `scaleX`). Bei reduzierter Bewegung steht der Dampf, der Text erklärt es.
- **Listen:** `RecipeCardSkeleton` in exakter Kartenform, Shimmer über
  `background-position`.
- **Buttons:** Inline-`Spinner` erlaubt; **seitenweise** Spinner sind durch
  Skeletons zu ersetzen.

## Bausteine

- **Button** ([Button.tsx](src/components/Button.tsx)): `primary` (gefüllter
  Akzent, eine pro Ansicht), `secondary`, `quiet`, `ghost`, `danger`; Größen
  `sm`/`md`/`lg` = min. 44/52/56 px hoch – Höhen als `min-h`, damit lange
  Beschriftungen wachsen dürfen.
- **Input/Textarea** ([Input.tsx](src/components/Input.tsx)): 52 px, 16 px
  Schrift, Fokusring 3 px `accent/25`.
- **Chip** ([CategoryPicker.tsx](src/components/CategoryPicker.tsx)): visuell
  leicht, Trefferfläche ≥ 44 px.
- **Segmented** ([Segmented.tsx](src/components/Segmented.tsx)): gleitender
  Thumb (nur `transform`), Radiogruppe mit Pfeiltasten; ersetzt Einheiten-,
  Sprach- und Theme-Wahl.
- **RecipeCover** ([RecipeCard.tsx](src/components/RecipeCard.tsx)): Bild oder
  Papierfläche; der Titel steht genau **einmal** im DOM (Überschrift unter dem
  Cover), damit Screenreader und Textsuche nicht doppelt treffen.
- **Sheet** ([Sheet.tsx](src/components/Sheet.tsx)): Radius 28, Griff, Titel mit
  Unterkante, bestehende Fokusfalle.
- **Toast** ([Toast.tsx](src/components/Toast.tsx)): Glas, Symbol in
  `good`/`danger`, `aria-live` je nach Art.

## Barrierefreiheit

- Alle interaktiven Ziele ≥ **44 × 44 px** (Daumenregel; wird per E2E-Check
  geprüft).
- Kontrast: Text ≥ 4.5:1, große Schrift und Flächengrenzen ≥ 3:1 – in **beiden**
  Modi.
- Zoom ist nie gesperrt (kein `maximumScale`/`userScalable`), `:focus-visible`
  überall sichtbar, Skip-Link vorhanden.
- Sprache: `<html lang="de">`; umschaltbare Texte kommen aus dem Wörterbuch.

## Theme-Wahl

`src/lib/theme.ts` hält die Wahl als externen Store (`useSyncExternalStore`):
`system` (kein Attribut → CSS entscheidet), `light`/`dark` (Attribut +
localStorage). Ein Inline-Script in [layout.tsx](src/app/layout.tsx) setzt die
Wahl **vor** dem ersten Paint, damit nichts aufblitzt. `viewport.themeColor`
liefert beide Werte per Media-Query; das Manifest bleibt statisch.

## Prüfen

```bash
npx playwright test e2e/design-audit.spec.ts   # Screenshots hell + dunkel (390/1440)
npx playwright test e2e/a11y.spec.ts           # 44-px-Ziele, Kontrast-Stichproben
```

Screenshots landen in `e2e/screenshots/design/`.
