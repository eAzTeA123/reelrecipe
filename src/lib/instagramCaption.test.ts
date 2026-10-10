import { describe, expect, it } from "vitest";
import { extractEmbedCaption, instagramEmbedUrl } from "./instagramCaption";

/** Ausschnitt einer echten Embed-Seite (Reel DdtwrLYtOiT, gekürzt). */
const EMBED_HTML = `
<div class="Caption">
  <a class="CaptionUsername" href="https://www.instagram.com/noahperlofit/">noahperlofit</a>
  <div class="CaptionContent">
    Save Your Life With Meal Prep‼️<br><br>Meal prep these bad BOYS and get my meal plans in my bio ❤️<br><br>
    😱Macros For Each Sub:<br><br>481 Calories<br>43g Protein<br>39g Carbs<br>17g Fat<br><br>
    🔥The Best Buff Chicken Subs (makes 12):<br><br>Chicken:<br><br>✅ - 1.5kg Trimmed Chicken Thighs<br><br>
    ✅ - 4 Packets Buffalo Seasoning<br><br>Other:<br><br>✅ - 4 Baguettes (Fully hollowed out interior)
  </div>
</div>`;

describe("extractEmbedCaption", () => {
  it("liest die vollständige Caption samt Nährwertzeilen", () => {
    const caption = extractEmbedCaption(EMBED_HTML)!;
    expect(caption).toContain("43g Protein");
    expect(caption).toContain("✅ - 1.5kg Trimmed Chicken Thighs");
    expect(caption).toContain("Chicken:");
  });

  it("entfernt den führenden Nutzernamen", () => {
    const caption = extractEmbedCaption(EMBED_HTML)!;
    expect(caption.startsWith("Save Your Life")).toBe(true);
  });

  it("gibt undefined zurück, wenn kein Caption-Block existiert", () => {
    expect(extractEmbedCaption("<html><body>nichts</body></html>")).toBeUndefined();
  });
});

describe("instagramEmbedUrl", () => {
  it("baut die Embed-URL aus Reel-Links", () => {
    expect(instagramEmbedUrl("https://www.instagram.com/reel/DdtwrLYtOiT/?cplk=abc")).toBe(
      "https://www.instagram.com/reel/DdtwrLYtOiT/embed/captioned/",
    );
    expect(instagramEmbedUrl("https://www.instagram.com/p/ABC123/")).toBe(
      "https://www.instagram.com/reel/ABC123/embed/captioned/",
    );
  });

  it("lehnt fremde Hosts und unbekannte Pfade ab", () => {
    expect(instagramEmbedUrl("https://example.com/reel/ABC123/")).toBeUndefined();
    expect(instagramEmbedUrl("https://www.instagram.com/noahperlofit/")).toBeUndefined();
  });
});
