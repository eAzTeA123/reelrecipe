
const text = "Tomaten-Käse-Pasta Zutaten (für ca. 3–4 Portionen) \t•\t300 g Pasta (z. B. Penne oder Rigatoni) \t•\t7–8 EL Tomatenmark";
const regex = /(?<=\s)[•*·????????.??"%?]\uFE0F?\s*|(?<=\s)-+\s+/gu;
console.log("Original:", JSON.stringify(text));
console.log("Replaced:", JSON.stringify(text.replace(regex, "\\n- ")));

