// app/middleware/site-level.js
const SITE_LEVEL = {
  LOGGED_OUT: 'logged-out',
  SITES_OVERVIEW: 'sites-overview',
  SITE_DETAIL: 'site-detail'
};

function siteLevelMiddleware(opts = {}) {
  const {
    loggedOutPaths = ['/', '/login'],
    overviewPath = '/sites',
    siteDetailPrefix = '/site/',
    ignorePrefixes = ['/public'],
    allowQueryOverride = true
  } = opts;

  const LOGGED_OUT_SET = new Set(loggedOutPaths);
  const IGNORE_SET = new Set(ignorePrefixes);
  const VALID = new Set(Object.values(SITE_LEVEL));

  return (req, res, next) => {
    const path = normalize(req.path);

    if (startsWithAny(path, IGNORE_SET)) return next();

    let depth;
    const override = typeof req.query?.level === 'string' ? req.query.level : null;
    if (allowQueryOverride && override && VALID.has(override)) {
      depth = override;
    } else {
      depth = classify(path, { LOGGED_OUT_SET, overviewPath, siteDetailPrefix });
    }

    const model = {
      depth, // 'logged-out' | 'sites-overview' | 'site-detail'
      isLoggedOut: depth === SITE_LEVEL.LOGGED_OUT,
      isOverview:  depth === SITE_LEVEL.SITES_OVERVIEW,
      isSite:      depth === SITE_LEVEL.SITE_DETAIL
    };

    res.locals.siteLevel = model;
    req.siteLevel = model;
    next();
  };
}

// --- helpers ---
function normalize(p) {
  if (!p) return '/';
  const cleaned = p.replace(/\/+$/g, '');
  return cleaned === '' ? '/' : cleaned;
}

function startsWithAny(path, prefixes) {
  for (const pref of prefixes) if (path.startsWith(pref)) return true;
  return false;
}

function classify(path, { LOGGED_OUT_SET, overviewPath, siteDetailPrefix }) {
  if (LOGGED_OUT_SET.has(path)) return SITE_LEVEL.LOGGED_OUT;
  if (path === overviewPath) return SITE_LEVEL.SITES_OVERVIEW;
  if (path.startsWith(siteDetailPrefix) && path.length > siteDetailPrefix.length) {
    return SITE_LEVEL.SITE_DETAIL;
  }
  // fallback – adjust if needed
  return SITE_LEVEL.LOGGED_OUT;
}

module.exports = { siteLevelMiddleware, SITE_LEVEL };
