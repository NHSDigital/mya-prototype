require("dotenv").config();
const { interpretUserInput } = require("./parser");

const fromEnv = () => {
  const flags = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith("FEATURE_")) continue;
    const name = key.replace("FEATURE_", "").toLowerCase();
    flags[name] = interpretUserInput(value);
  }
  return flags;
};

module.exports = fromEnv();
