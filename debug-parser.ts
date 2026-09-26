import { parseRecipe } from './src/parser/index.ts';

const text = `ZUM REZEPT ⬇️
.
.
❤️🧡💛
Wenn euch meine Rezepte gefallen und ihr mich unterstützen wollt, 
dann könnt ihr gerne bei PROZIS den 
Rabattcode: ❗️👉🏼NOEL👈🏼❗️
benutzen um immer Rabatte und Gratis Produkte zu erhalten 
❤️🧡💛
*ANZElGE
.
.
.
🥗🍳🥑
Nährwerte (alles insgesamt)
1384kcal, 32g K, 198g E, 48g F
🥗🍳🥑
.
.
.
⚖️🔢⏳⏲️
Mengenangaben:
.
- 500g Magerquark
- 4 verquirlte Eier
- 50g Gouda gerieben, leicht
- 1 EL Tomatenmark
- 1 EL Flohsamenschalen
- 1g Salz
.
- 1 rote Zwiebel
- 300g (roh gewogen) Hahnchen
angebraten
- 100g Gouda gerieben, leicht
.
⚖️🔢⏳⏲️
.
. 
- BACKOFEN: 220 Grad O/U-Hitze ~ 25-30min
.`;

console.log(JSON.stringify(parseRecipe(text), null, 2));
