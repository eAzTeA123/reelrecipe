
import { parseRecipe } from "./src/parser/index";
const text = `Spinat Feta Pasta 300 g Nudeln deine Wahl 1 Block Feta 250g TK Spinat 200g Tomaten 200 ml Sahne 3 EL Olivenöl 1/2 TL Pfeffer 1/2 TL Oregano 1/2 TL Paprikapulver Ein bisschen Nudelwasser Mit Salz abschmecken 1. Feta, Tomaten, TK Spinat in eine Auflaufform geben 2. Alles mit Öl beträufeln und anschließend Sahne hinzugehen und im vorgeheizten Ofen für ca 15 - 20 Minuten Umluft backen. 3. Gewürze sowie ganz wenig Nudelwasser hinzugehen und alles gut miteinander vermengen. Dabei den Feta sowie die Tomaten ebenfalls gut klein machen. 4. Gekochte Nudeln unterrühren  #rezepte #rezept #schnellerezepte #lecker #rezeptideen #recipeideas`;
console.log(JSON.stringify(parseRecipe(text), null, 2));

