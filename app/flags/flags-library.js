const envFlags = require("./env");
const defaults = require("./defaults");
const { interpretUserInput } = require("./parser");

const parseQueryOverrides = (req) => {
  const overrides = {};
  if (!req.query.features) return overrides;

  for (const item of String(req.query.features).split(",")) {
    const [rawKey, rawVal] = item.split(":");
    if (!rawKey) continue;

    const key = rawKey.trim();
    const raw = (rawVal ?? "true").trim();

    overrides[key] = interpretUserInput(raw);
  }
  return overrides;
};

const parseFormOverrides = (req) => {
  const overrides = {};
  if (req.method !== "POST" || !req.body) return overrides;

  const featuresFromForm = req.body.features || {};
  for (const [key, raw] of Object.entries(featuresFromForm)) {
    if (raw === "" || raw === null) continue;
    overrides[key] = interpretUserInput(raw);
  }
  return overrides;
};

const buildFlags = (req) => {
  const sessionOverrides = req.session?.features || {};
  const queryOverrides = parseQueryOverrides(req);
  const formOverrides = parseFormOverrides(req);

  const flags = {
    ...defaults,
    ...envFlags,
    ...sessionOverrides,
    ...queryOverrides,
    ...formOverrides,
  };

  // persist query/form overrides into session (raw values only)
  const newValues = { ...queryOverrides, ...formOverrides };
  if (Object.keys(newValues).length) {
    req.session.features = { ...sessionOverrides, ...newValues };
  }

  return flags;
};

const flagsMiddleware = () => (req, res, next) => {
  const flags = buildFlags(req);
  req.features = flags;
  res.locals.features = flags;
  next();
};

module.exports = { flagsMiddleware };