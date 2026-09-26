
import { parseRecipe } from "./src/parser/index";
const text = `Die leckerste Crepês Bowl!!! ??????  Zutaten: Zutaten - 240g Mehl - 3 Eier - 350ml Vollmilch - 50ml Wasser  - 1 EL Zucker - 1 Prise Salz - 30g Butter (erwärmt)  - Obst eurer Wahl  - 100g Schokolade & 1 TL Kokosfett Alle Zutaten vermengen. Pfanne erstmal ordentlich erhitzen, danach ganz Wenig Butter hinzugeben und schmelzen lassen. Jetzt können die Crepes zubereitet werden.  Die Crepes dünne Streifen schneiden. Danach könnt ihr Obst eurer Wahl hinzugeben. Für die Schokoladensoße habe ich 100g Vollmilchschokolade  und einen Teelöffel Kokosfett erwärmt.  Es schmeckt soooooo lecker guten Appetit!!!????`;
console.log(JSON.stringify(parseRecipe(text)?.ingredients.slice(0, 2), null, 2));

