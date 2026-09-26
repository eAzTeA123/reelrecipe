
const fs = require("fs");
let code = fs.readFileSync("src/parser/strategies/sentenceStateMachine.ts", "utf8");
code = code.replace(
  "|wraps|tomaten?",
  "|wraps|block|packung|pck|dose|glas|zehe|zehen|tomaten?"
);
fs.writeFileSync("src/parser/strategies/sentenceStateMachine.ts", code);

