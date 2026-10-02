import { describe, expect, it } from "vitest";
import { parseRecipe } from "./index";
import { cleanTitle, extractTitleFromHeadline } from "./meta";

/**
 * Titel-Bereinigung.
 *
 * Alle Beispiele stammen aus echten Captions der eigenen Bibliothek
 * (Sicherungskopie des Betreibers) – nicht erfunden. Freigegeben wurde:
 * Anpreisungen am Anfang und Nutzen-Floskeln am Ende entfernen; Ernährungs- und
 * Zubereitungsangaben (High Protein, Low Carb, Bulking, One Pot) bleiben.
 */
describe("cleanTitle", () => {
  it("entfernt Anpreisungen am Anfang", () => {
    expect(cleanTitle("🔥 Geiler Flammkuchen mit Chicken")).toBe("Flammkuchen mit Chicken");
    expect(cleanTitle("MEGA leckerer Schokokuchen")).toBe("Schokokuchen");
    expect(cleanTitle("DAS SIND MIT ABSTAND DIE BESTEN CHEESEBURGER")).toBe("CHEESEBURGER");
    expect(cleanTitle("Super schnelle Pasta")).toBe("Schnelle Pasta");
  });

  it("entfernt Nutzen-Floskeln am Ende", () => {
    expect(cleanTitle("DÖNERTELLER zum abnehmen 💪🏻")).toBe("DÖNERTELLER");
    expect(cleanTitle("HIGH PROTEIN TACOS ZUM ABNEHMEN")).toBe("HIGH PROTEIN TACOS");
    expect(cleanTitle("High Protein Tacos zum Abnehmen")).toBe("High Protein Tacos");
  });

  it("entfernt Emojis samt Hautton-Modifier", () => {
    expect(cleanTitle("Episode 2: Zitronenkuchen☝🏽")).toBe("Episode 2: Zitronenkuchen");
    expect(cleanTitle("High Protein Smashburger 🍔💪🏾")).toBe("High Protein Smashburger");
    expect(cleanTitle("💨 172 Cal OREO Protein Cheesecake")).toBe("172 Cal OREO Protein Cheesecake");
  });

  it("lässt Beschreibungen, Ernährungs- und Zubereitungsangaben stehen", () => {
    // „Cremige" ist eine Beschreibung, keine Anpreisung
    expect(cleanTitle("Cremige Gochujang-Kokos-Linsen")).toBe("Cremige Gochujang-Kokos-Linsen");
    expect(cleanTitle("Bulking Nudelpfanne")).toBe("Bulking Nudelpfanne");
    expect(cleanTitle("Low Carb Hühnchen Peperoni Pizza")).toBe("Low Carb Hühnchen Peperoni Pizza");
    expect(cleanTitle("Pesto Rosso Hähnchen Reis One Pot")).toBe("Pesto Rosso Hähnchen Reis One Pot");
    expect(cleanTitle("Flammkuchen (Chicken)")).toBe("Flammkuchen (Chicken)");
    expect(cleanTitle("Magerquark")).toBe("Magerquark");
  });

  it("räumt hinweisende Fürwörter weg, wenn der Titel dahinter beginnt", () => {
    expect(cleanTitle("Dieser herzhafte Ofenpfannkuchen")).toBe("Herzhafte Ofenpfannkuchen");
  });
});

describe("extractTitleFromHeadline", () => {
  it("nimmt das Gericht hinter dem Doppelpunkt, wenn davor ein Satz steht", () => {
    // Echte Caption-Zeile aus der Bibliothek
    expect(
      extractTitleFromHeadline(
        "Wenn's schnell gehen muss, aber trotzdem richtig lecker sein soll: Dieser herzhafte Ofenpfannkuchen",
      ),
    ).toBe("Herzhafte Ofenpfannkuchen");
  });

  it("nimmt weiterhin das Gericht vor dem Doppelpunkt", () => {
    expect(extractTitleFromHeadline("Die beste Lasagne-Suppe aller Zeiten: Der Party-Trend im Netz")).toBe(
      "Lasagne-Suppe",
    );
    expect(extractTitleFromHeadline("🔥 Ofensuppe")).toBe("Ofensuppe");
  });

  it("erkennt Zutaten- und Werbezeilen weiterhin nicht als Titel", () => {
    expect(extractTitleFromHeadline("4 Eier")).toBeUndefined();
    expect(extractTitleFromHeadline("150 g Mehl")).toBeUndefined();
  });
});

describe("Titel im vollständigen Ablauf", () => {
  it("liest aus der echten Caption den Gerichtsnamen statt einer Zutat", () => {
    // Der Fall, in dem der Parser vorher „Eier" als Titel ausgab
    const caption = [
      "Wenn's schnell gehen muss, aber trotzdem richtig lecker sein soll: Dieser herzhafte Ofenpfannkuchen",
      "",
      "👉 Kein Pfannkuchen-Wenden, kaum Aufwand und in weniger als 30 Minuten steht ein herrlich fluffiger",
      "",
      "📌Speicher dir das Rezept unbedingt ab – das wirst du garantiert öfter machen!",
      "",
      "➡️ Rezept:",
      "",
      "4 Eier",
      "150 g Mehl",
      "150 g Quark",
      "ca. 200 ml Milch",
    ].join("\n");

    const parsed = parseRecipe(caption);
    expect(parsed?.title).toBe("Herzhafte Ofenpfannkuchen");
    expect(parsed?.ingredients.map((i) => i.name)).toContain("Mehl");
  });
});
