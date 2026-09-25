# Rezept – Rezept-Organizer (Local-only MVP)

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

- `src/domain/` – Typen (`Recipe`, `Ingredient`, `RecipeStep`, `ShoppingItem`, `BackupFile`), Kategorien.
- `src/data/` – Repository-Schicht. Die UI nutzt nur `data/index.ts` (`getRecipeRepository()` etc.).
  Konkrete Implementierung: `data/local/*` (Dexie/IndexedDB). Für Supabase später: neue
  Implementierung der Interfaces + Austausch in `data/index.ts`. **Die UI darf Dexie nie direkt importieren.**
- `src/parser/` – heuristischer Rezeptparser (Regex/Scoring, DE+EN, keine KI). Tests: `*.test.ts`.
- `src/lib/` – `scale` (Portionen, nicht-destruktiv), `shoppingMerge`, `image` (Canvas-Kompression),
  `instagram` (URL-Validierung), `text` (IDs, Such-Normalisierung).
- `src/hooks/` – `useRecipes`, `useRecipe`, `useShoppingList` (Dexie liveQuery), `useImageUrl`
  (löst `local-image:<id>`-Referenzen zu Object-URLs auf).
- `src/app/api/instagram/` – Caption-Abruf: offizielles oEmbed wenn `INSTAGRAM_OEMBED_TOKEN` gesetzt,
  sonst öffentliche og:-Meta-Tags. `image/` = Proxy mit Host-Allowlist (cdninstagram.com, fbcdn.net).

## Konventionen

- Bilder werden als `local-image:<uuid>`-Referenz in `Recipe.image` gespeichert (Blob in Tabelle `images`).
- Mengen-Inputs akzeptieren `1 1/2`, `2,5`, `0.5` → `parseAmountString` aus `src/parser`.
- Deutsche UI-Texte, klare Fehlermeldungen (keine technischen Fehler an User).
- Mobile-first (390×844), Bottom-Nav < md, Top-Nav ≥ md, `prefers-reduced-motion` respektiert.
- Keine neuen Runtime-Dependencies ohne Not.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
