/**
 * Caption aus der Instagram-Embed-Seite lesen.
 *
 * Warum überhaupt: Die normale Seite liefert in `og:description` eine gekürzte
 * Fassung – gemessen an einem Reel fehlte darin die Zeile „43g Protein", die in
 * der gespeicherten Bibliothek dann fehlte. Die Embed-Seite
 * (`/embed/captioned/`) enthält die Caption vollständig und funktioniert auch,
 * wenn die normale Seite eine Anmeldewand zeigt. Vorher setzte die App
 * ausschließlich auf `og:description`.
 */

/** Embed-URL zu einem Instagram-Link (Reel, Post oder TV). */
export function instagramEmbedUrl(url: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (!/(^|\.)instagram\.com$/i.test(parsed.hostname)) return undefined;
  const code = parsed.pathname.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/)?.[1];
  if (!code) return undefined;
  return `https://www.instagram.com/reel/${code}/embed/captioned/`;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, digits: string) => String.fromCodePoint(parseInt(digits, 10)));
}

/**
 * Caption aus dem HTML der Embed-Seite holen. `undefined`, wenn kein
 * Caption-Block vorhanden ist oder er zu kurz ist.
 */
export function extractEmbedCaption(html: string): string | undefined {
  /*
   * Nur den **Inhalt** des Caption-Blocks nehmen. Vorher begann der Ausschnitt
   * mitten im öffnenden Tag, dadurch stand `class="Caption">` als Text am Anfang.
   */
  const block = html.match(/<div[^>]*class="[^"]*Caption[^"]*"[^>]*>([\s\S]{0,40000}?)<\/div>/i);
  if (!block) return undefined;

  const text = decodeEntities(
    block[1]
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n"),
  );

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, all) => !(line === "" && all[index - 1] === ""));

  // Der Block beginnt mit dem Nutzernamen (eine Zeile ohne Leerzeichen)
  while (lines.length > 0 && lines[0] === "") lines.shift();
  if (lines[0] && !lines[0].includes(" ") && lines[0].length < 40) lines.shift();

  const caption = lines.join("\n").trim();
  return caption.length >= 5 ? caption : undefined;
}
