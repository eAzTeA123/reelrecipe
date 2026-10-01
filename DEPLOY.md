# Auf Vercel betreiben

Ziel: Überall – auf dem Handy wie am Desktop – läuft ein **Produktions-Build**
statt eines Dev-Servers. Genau das ist der Unterschied, der Leistung messbar
verändert (`next dev` kompiliert jede Route beim ersten Aufruf und lässt
Navigationen wie verlorene Tipps wirken). Messwerte: siehe `AGENTS.md` und
`e2e/perf.spec.ts`.

## In drei Schritten

1. **Vercel-Konto:** https://vercel.com/signup – GitHub-Login ist am schnellsten.
2. **Repository importieren:** https://vercel.com/new → `eAzTeA123/reelrecipe`
   auswählen → *Import*. Das Framework wird als **Next.js** erkannt; Build-Befehl
   und Ausgabeverzeichnis bleiben **leer**. Ein `vercel.json` ist nicht nötig.
3. **Deploy** drücken. Nach etwa einer Minute läuft die App unter
   `https://<projekt>.vercel.app` – dank HTTPS als echte PWA installierbar.

Ab dann gilt: **jeder Push auf `main` wird automatisch gebaut und
veröffentlicht.** Ein Dev-Server ist im Alltag nicht mehr nötig.

## Umgebungsvariablen (optional, aber empfohlen)

| Name | Wirkung |
| --- | --- |
| `INSTAGRAM_OEMBED_TOKEN` | Instagram-Links werden über die offizielle oEmbed-API gelesen. |

Ohne diesen Token liest die App die og:-Meta-Tags der Seite. Von einem
Heimanschluss klappt das; von Vercels Rechenzentrums-IPs blockt Instagram das
aber oft (Login-Wand, 429). Der Weg, der **immer** funktioniert: den
Caption-Text direkt einfügen – die App kann das („Rezepttext direkt einfügen").
Für TikTok gilt dieselbe Einschränkung.

Setzen unter *Project → Settings → Environment Variables*, danach einmal
*Redeploy*.

## Was der Umzug ändert – wichtig

**Jedes Gerät hat seine eigene Bibliothek.** Die App speichert alles in
IndexedDB des jeweiligen Browsers; es gibt kein Konto und keine Cloud. Konkret:

- Handy und Desktop haben nach dem Umzug **getrennte** Rezeptsammlungen.
- Die bestehende Bibliothek wandert per **Einstellungen → Exportieren** →
  Datei auf dem Zielgerät → **Importieren**.
- Einzelne Rezepte und Einkaufslisten lassen sich weiterhin über den
  Teilen-Code übergeben.

Echter Abgleich zwischen Geräten wäre ein eigenes Vorhaben: Die Datenschicht ist
darauf vorbereitet – eine zweite Implementierung der Repository-Interfaces
(z. B. Supabase) und der Austausch in `src/data/index.ts`. Die Oberfläche müsste
dafür nicht angefasst werden.

## Region (optional)

Standardmäßig laufen die Serverless-Funktionen in `iad1` (USA). Kürzer ist
`fra1` (Frankfurt): *Project → Settings → Functions → Region*. Auf das Tempo der
Oberfläche wirkt das kaum, weil die Seiten statisch ausgeliefert werden – es
betrifft nur Link-Import und Bildproxy.
