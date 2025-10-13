require('dotenv').config();

const fromEnv = () => {
  const flags = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('FEATURE_')) {
      const name = key.replace('FEATURE_', '').toLowerCase();

      //parse bools, numbers, JSON or leave as a string
      let parsedValue = value;

      //bools
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;

      //numbers
      else if (!Number.isNaN(Number(value))) parsedValue = Number(value);

      //JSON
      else if(
        (value.startsWith('{') && value.endsWith('}')) || 
        (value.startsWith('[') && value.endsWith(']'))
      ) {
        try { parsedValue = JSON.parse(value); }
        catch { parsedValue = value; }
      }

      flags[name] = parsedValue;

    }
  }
  return flags;
}

module.exports = fromEnv();
