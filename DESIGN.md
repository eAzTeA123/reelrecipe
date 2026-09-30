# Scroll2Cook – Design-System

Markenvertrag für die Oberfläche. Wer Farben, Schrift, Radien oder Schatten
ändert, ändert sie **hier** und in `src/app/globals.css` (`@theme`) – nicht in
einzelnen Komponenten. Alles andere findet die Tokens automatisch.

## Idee

Ein persönliches Kochbuch, kein Dashboard. Warmes Papier, eine gedämpfte
Terrakotta-Farbe als einziger Akzent, Serif-Überschriften wie auf einem
Buchtitel und die eigenen Rezeptfotos als einzige Bildsprache. Keine
Stockfotos, keine Verläufe als Dekoration, keine zweite Markenfarbe.

## Farbe

| Token | Wert | Rolle |
| --- | --- | --- |
| `--color-bg` | `#fbf6ef` | Papier – Seitenhintergrund (auch `themeColor` in `layout.tsx`) |
| `--color-surface` | `#ffffff` | Karten, Panels, Eingaben |
| `--color-surface-2` | `#f4ebdf` | Sand: Chips, Sekundärflächen, Skeleton |
| `--color-ink` | `#211a15` | Text, warmes Fast-Schwarz (nie `#000`) |
| `--color-ink-2` | `#6a5c50` | Sekundärtext |
| `--color-ink-3` | `#7d6e5c` | Kleinste Schrift – hält 4.5:1 auf Weiß |
| `--color-line` | `#e6dac9` | Ränder, Trenner |
| `--color-accent` | `#c0563a` | **Der** Akzent: Aktionen, aktive Zustände, Eyebrows |
| `--color-accent-soft` | `#f8e8e0` | Akzentfläche (Hintergrund von Hinweisen) |
| `--color-accent-ink` | `#fff8f4` | Text auf Akzent |
| `--color-good` | `#4f6b4a` | Kräutergrün: „passt", Erfolg |
| `--color-warn` | `#9a6f1f` | Ocker: unsicher, teilweise |
| `--color-danger` | `#a3302a` | Ziegel: löschen, Fehler |

**Regeln:** alle Grautöne warm (nie Zink/Neutral-Kalt), Sättigung des Akzents
unter 80 %, genau **ein** Akzent (kein zweiter für „Neu"/„Beta"), Schatten
immer warm getönt (`rgba(58,38,24,…)`) und von oben beleuchtet.

## Schrift

- **Display:** Instrument Serif (`--font-display`, Utility `font-display`) –
  Seiten- und Kartentitel, Wortmarke, Kochbuch-Cover. Nur Gewicht 400;
  Größe, nicht Fettung erzeugt Wirkung.
- **UI/Text:** Manrope (`--font-sans`) – alles andere.

| Token | Größe | Einsatz |
| --- | --- | --- |
| `text-display` | `clamp(2.75rem, 8vw, 4.5rem)` | Kochbuch-Cover |
| `text-title` | `clamp(1.625rem, 5.5vw, 2.5rem)` | Seitentitel (`PageHeader`) |
| `text-h1` | `clamp(1.5rem, 4.5vw, 2rem)` | Abschnittstitel, leere Zustände |
| `text-h2` | 21px | Untertitel, Karten-Cover-Fallback |
| `text-card` | 21px | Kartentitel (Serif) |
| `text-h3` | 17px | Fließtext-Betonung |
| `text-body` | 15px | Standardtext |
| `text-meta` | 13px | Hinweise, Meta-Zeilen |
| `text-label` | 12px | Eyebrows, Chips |

**Regeln:** keine neuen willkürlichen `text-[Npx]`-Werte – fehlt eine Größe,
kommt sie als Token in `globals.css`. Eingabefelder bleiben bei **16px**
(iOS zoomt sonst beim Fokussieren). Zahlen in Listen (`Min`, Portionen,
Mengen) bekommen `nums` (tabellarische Ziffern). Großbuchstaben nur für
Eyebrows; Schaltflächen und Badges in Normalschreibung.

## Form und Tiefe

| Token | Wert | Einsatz |
| --- | --- | --- |
| `--radius-ctl` | 12px | Buttons, Eingaben, kleine Flächen |
| `--radius-card` | 20px | Karten, Panels, Dialoge |
| `--radius-frame` | 26px | Medien, Cover, leere Zustände |
| `--radius-pill` | 999px | Chips, Icon-Buttons, Herz |

`--shadow-card` für alles Ruhende auf dem Papier, `--shadow-pop` nur für
Schwebendes (Dialog, Toast, Hover-Anhebung via `.card-hover`). Abstände in
4-px-Schritten; Reihen in Listen bekommen mehr Luft als Spalten
(`gap-x-5 gap-y-9`).

## Bewegung

`--ease-out` für Eintritte, `--ease-spring` für Druck und Sheets. Alles
Interaktive liegt auf `.pressable` (aktives Feedback `scale(0.97)`).
Scroll-Reveals über `Reveal` (`src/components/Reveal.tsx`): einmalig, ≤ 10 px
Versatz, gestaffelt über `--reveal-delay`. `prefers-reduced-motion` schaltet
jede Animation ab – neue Bewegung muss dort ebenfalls aus sein.

## Bausteine

- **Button** (`src/components/Button.tsx`): `primary` (eine pro Ansicht),
  `secondary` (Standard), `quiet`, `ghost`, `danger`. Größen `sm`/`md`/`lg`.
- **Karten:** `RecipeCover` (Bild oder Papier-Cover mit Serif-Titel) +
  Metazeile. Karten haben **keine** Trennlinien mehr; Abstand und Schatten
  strukturieren die Liste.
- **Sammlungen** (`/collections`): eigene Filter statt Tags; Mitgliedschaft
  liegt in der Sammlung.
- **Zustände:** jeder Bereich braucht Lade- (Skeleton in Kartenform), Leer-
  und Fehlerzustand. Fokus ist immer sichtbar (`:focus-visible`, Akzentring).

## Stimme

Deutsch, aktiv, konkret, ohne Ausrufezeichen und ohne Marketingsprache
(„Elevate", „seamless", „nächste Generation"). Fehler sagen, was zu tun ist.
Zahlen und Einheiten mit schmalem Leerzeichen zwischen Wert und Einheit.
