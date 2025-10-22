const envFlags = require('./env')
const defaults = require('./defaults')


// Parse overrides from the querystring
// E.g., `?feature=calendar:on,search:off`
const parseQueryOverrides = (req) => {
  const overrides = {};

  if(req.query.features) {
    const items = String(req.query.features).split(',');
    for (const item of items) {
      const [rawKey, rawVal] = item.split(':');
      if (!rawKey) continue;
      const key = rawKey.trim();
      //set value to true if none is provided
      const val = (rawVal ?? 'true').trim();

      //normalise and add the key/value to the overrides object
      overrides[key] = normaliseValue(val);
    }
  }

  return overrides;

}

const parseFormOverrdes = (req) => {
  const overrides = {};

  //only process form post data
  if (req.method !== 'POST') return overrides;

  //only process POST with body data
  if (!req.body) return overrides;

  const featuresFromForm = req.body.features || {};
  for (const [key, value] of Object.entries(featuresFromForm)) {
    if (value === '' || value === null) continue;
    overrides[key] = normaliseValue(String(value));
  }
  return overrides;
}

const normaliseValue = (val) => {
  if (val === 'on' || val === 'true') return true;
  if (val === 'off' || val === 'false') return false;
  if (!Number.isNaN(Number(val))) return Number(val);
  try { return JSON.parse(val); } catch { return val; }
}

const buildFlags = (req) => {
  const sessionOverrides = req.session?.features || {};
  const queryOverrides = parseQueryOverrides(req);
  const formOverrides = parseFormOverrdes(req);
  const flags = {
    ...defaults,
    ...envFlags,
    ...sessionOverrides,
    ...queryOverrides,
    ...formOverrides
  }

  //persist anything new in the form or query string
  const newValues = {
    ...queryOverrides,
    ...formOverrides
  }
  if (Object.keys(newValues).length) {
    req.session.features = {
      ...sessionOverrides,
      ...newValues
    }
  }

  return flags;
}

const flagsMiddleware = () => {
  return (req, res, next) => {
    const flags = buildFlags(req);

    //attach flags to req to use in routes
    req.features = flags;

    //attach flags to locals to use in views
    res.locals.features = flags;

    next();
  }
}

module.exports = { flagsMiddleware };