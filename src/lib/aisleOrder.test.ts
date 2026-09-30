import { describe, expect, it } from "vitest";
import { sortAisles } from "./shoppingAisles";

describe("sortAisles", () => {
  it("sortiert ohne Lerndaten alphabetisch und stellt Sonstiges zuletzt", () => {
    expect(sortAisles(["Obst & Gemüse", "Sonstiges", "Backwaren"], new Map())).toEqual([
      "Backwaren",
      "Obst & Gemüse",
      "Sonstiges",
    ]);
  });

  it("stellt gelernte Abteilungen nach Durchschnittsposition nach vorn", () => {
    const learned = new Map([
      ["Kühlregal", 1],
      ["Obst & Gemüse", 0],
    ]);
    expect(sortAisles(["Kühlregal", "Obst & Gemüse", "Backwaren"], learned)).toEqual([
      "Obst & Gemüse",
      "Kühlregal",
      "Backwaren",
    ]);
  });

  it("lässt ungelernte Abteilungen unter sich alphabetisch", () => {
    const learned = new Map([["Kühlregal", 0]]);
    expect(sortAisles(["Trockenprodukte", "Kühlregal", "Backwaren"], learned)).toEqual([
      "Kühlregal",
      "Backwaren",
      "Trockenprodukte",
    ]);
  });

  it("entscheidet Gleichstand alphabetisch", () => {
    const learned = new Map([
      ["Kühlregal", 2],
      ["Backwaren", 2],
    ]);
    expect(sortAisles(["Kühlregal", "Backwaren"], learned)).toEqual(["Backwaren", "Kühlregal"]);
  });

  it("hält Sonstiges auch dann zuletzt, wenn es gelernt wäre", () => {
    const learned = new Map([
      ["Sonstiges", 0],
      ["Kühlregal", 5],
    ]);
    expect(sortAisles(["Sonstiges", "Kühlregal"], learned)).toEqual(["Kühlregal", "Sonstiges"]);
  });

  it("verändert die Eingabeliste nicht", () => {
    const input = ["B", "A"];
    sortAisles(input, new Map());
    expect(input).toEqual(["B", "A"]);
  });
});
