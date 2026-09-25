import { describe, expect, it } from "vitest";
import { formatAmount, scaleAmount } from "./scale";
import { parseBackup } from "@/data/backup";

describe("scaleAmount & formatAmount (A02)", () => {
  it("formatiert 0.2 g präzise als 0,2 g und nicht als 1/8 g", () => {
    expect(formatAmount(0.2, "g")).toBe("0,2 g");
  });

  it("formatiert kleine positive Werte wie 0.04 g nicht als 0 g", () => {
    expect(formatAmount(0.04, "g")).toBe("0,04 g");
  });

  it("behandelt unbekannte Basisportionen nicht als 1", () => {
    // Bei undefined als originalServings soll scaleAmount entweder undefined zurückgeben
    // oder die unveränderte Menge, anstatt stillschweigend von 1 auszugehen
    expect(scaleAmount(500, undefined, 4)).toBe(500);
  });
});

describe("Backup-Validierung (A04)", () => {
  it("lehnt Backups mit negativen Mengen ab", () => {
    const json = JSON.stringify({
      app: "rezept",
      version: 1,
      recipes: [
        {
          id: "r1",
          title: "Test",
          ingredients: [{ id: "i1", name: "Salz", amount: -5 }],
          steps: [{ id: "s1", instruction: "Kochen", order: 1 }],
        },
      ],
    });
    expect(() => parseBackup(json)).toThrow(/Ungültige Menge/);
  });

  it("lehnt Backups mit negativen oder ungültigen Portionen ab", () => {
    const json = JSON.stringify({
      app: "rezept",
      version: 1,
      recipes: [
        {
          id: "r1",
          title: "Test",
          servings: -2,
          ingredients: [{ id: "i1", name: "Salz", amount: 5 }],
          steps: [{ id: "s1", instruction: "Kochen", order: 1 }],
        },
      ],
    });
    expect(() => parseBackup(json)).toThrow(/Portionenanzahl/);
  });
});
