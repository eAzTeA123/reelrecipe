# Scroll2Cook

Rezepte aus Instagram, TikTok, Chefkoch und Foodblogs einsammeln, planen,
einkaufen und kochen – als installierbare Web-App. Alle Daten bleiben **lokal im
Browser** (IndexedDB): kein Konto, kein Backend, keine Werbung.

## Selbst betreiben

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/eAzTeA123/reelrecipe)

Der Knopf öffnet Vercel mit diesem Repository; Framework, Build-Befehl und
Ausgabeverzeichnis werden automatisch erkannt. Danach läuft unter
`https://<projekt>.vercel.app` **immer ein Produktions-Build** – auf dem Handy
wie am Desktop, und jeder Push auf `main` wird automatisch veröffentlicht.
Details, Umgebungsvariablen und die Grenzen: [`DEPLOY.md`](DEPLOY.md).

**Wichtig zu wissen:** Da alles lokal gespeichert wird, hat **jedes Gerät seine
eigene Bibliothek**. Umziehen lässt sie sich über *Einstellungen → Exportieren /
Importieren*, einzelne Rezepte über den Teilen-Code.

## Lokal entwickeln

```bash
npm install
npm run dev        # Dev-Server (http://localhost:3000)
npm run build      # Produktions-Build
npm run start      # Produktions-Server
```

Für **Leistungsurteile** immer der Produktions-Build: `next dev` kompiliert jede
Route beim ersten Aufruf, Navigationen dauern dadurch Sekunden und wirken wie
verlorene Tipps.

## Prüfen

```bash
npm run typecheck                        # tsc --noEmit
npm run lint                             # ESLint
npm run test                             # Parser-Unit-Tests (Vitest)
npm run build && npm run test:e2e        # Playwright (startet next start auf :3100)
npx playwright test e2e/perf.spec.ts     # Lastmessung mit 120 Rezepten
npx playwright test e2e/a11y.spec.ts     # 44-px-Bedienziele, helle und dunkle Ansicht
npx playwright test e2e/design-audit.spec.ts   # Screenshots nach e2e/screenshots/design/
```

## Weiterlesen

- [`DESIGN.md`](DESIGN.md) – Markenvertrag: Farben, Schrift, Radien, Bewegung, Illustrationen
- [`AGENTS.md`](AGENTS.md) – Architektur, Konventionen, Parser-Corpus
- [`DEPLOY.md`](DEPLOY.md) – Vercel-Betrieb
