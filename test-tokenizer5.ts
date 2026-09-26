
import { lineStateMachineStrategy } from "./src/parser/strategies/lineStateMachine";
const simulatedText = `Cremige Schinkenpasta Zutaten (für ca. 2–3 Portionen)
- 300 g Pasta
- 100 g Schinken, klein geschnitten
- 100 g Parmesan, gerieben
- 2 kleine rote Zwiebeln, fein gewürfelt
- 600 ml Sahne
- 1 EL Pesto Rosso (nach Geschmack gerne mehr)
- Etwas Pastawasser Gewürze
- Salz
- Pfeffer
- Knoblauchpulver
- Tomatensalz
- Paprikapulver (edelsüß)
Zubereitung:
1.
Die Pasta nach Packungsanweisung al dente kochen.`;
const res = lineStateMachineStrategy.parse(simulatedText);
console.log(res.ingredients);

