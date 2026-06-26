// -----------------------------------------------------------------------------
// Per-site context middleware
// -----------------------------------------------------------------------------
// Captures site_id for /site/:id routes and enhances req.session.data for the
// current site BEFORE any journey route runs: merges recurring -> daily
// availability, builds slot lookups, session history, and per-site user.
//
// Extracted verbatim from the head of the original app/routes/base.js so every
// journey (which previously relied on this running first) keeps identical
// behaviour. Registered once, centrally, in app/journeys/index.js.
// -----------------------------------------------------------------------------

const {
  getToday,
  asArray,
  clone,
  mergeDailyAvailability,
  enhanceData,
  buildSessionHistory,
  buildPastSessionHistory,
  slotMatchesSession,
  isSeriesHistoryRow,
  sessionDataDefaults,
} = require('./helpers');

// Capture site_id once for all /site/:id routes
function idParamHandler(req, res, next, id) {
  req.site_id = id;
  res.locals.site_id = id; // expose to templates
  next();
}

// Enhance data for the current site before any route runs
function siteContextMiddleware(req, res, next) {
  const data = req.session.data;
  // Set defensively: this middleware is registered centrally with `.use('/site/:id')`,
  // and param handlers do not cascade into the journey sub-routers, so derive site_id
  // from the matched route param and persist it on req for every downstream journey.
  const site_id = String(req.site_id || req.params.id || '');
  req.site_id = site_id;
  res.locals.site_id = site_id;
  const isClinicsCreateFlowPath = /^\/clinics\/(type-of-clinc|details|dates|days|time-and-capacity|clinic-times|appointments-calculator|services|clinic-closures(?:\/.*)?|check-answers|success)$/.test(req.path);
  const isClinicsEditFlowPath = /^\/clinics\/edit\/.+/.test(req.path);

  // Hide top-level navigation on create/edit flow pages to reduce context switching.
  res.locals.hideMainNav = isClinicsCreateFlowPath || isClinicsEditFlowPath;

  const today = getToday();
  const sessionFilters = data.filters?.[site_id] || {};
  const from = req.query.from ?? sessionFilters.from ?? null;
  const until = req.query.until ?? sessionFilters.until ?? null;

  // Keep filter state intentionally small in baseline mode.
  data.filters = data.filters || {};
  data.filters[site_id] = {
    from,
    until
  };

  data.today = today;

  // Backfill new user override maps for existing sessions started before this feature.
  if (!data.default_user && sessionDataDefaults.default_user) {
    data.default_user = clone(sessionDataDefaults.default_user);
  }

  if (!data.users_by_site && sessionDataDefaults.users_by_site) {
    data.users_by_site = clone(sessionDataDefaults.users_by_site);
  }

  if (!data.legacy_sessions_by_site && sessionDataDefaults.legacy_sessions_by_site) {
    data.legacy_sessions_by_site = clone(sessionDataDefaults.legacy_sessions_by_site);
  }

  const defaultUser = data.default_user || data.user;
  const siteUser = data.users_by_site?.[site_id];
  data.user = clone(siteUser || defaultUser);


  if (!data?.sites?.[site_id]) {
    console.warn(`⚠️ Site ${site_id} not found in session data`);
    return res.status(404).send('Site not found');
  }

  const siteDailyAvailability = data.daily_availability?.[site_id] || {};
  const siteRecurringSessions = data.recurring_sessions?.[site_id] || {};
  const siteBookings = data.bookings?.[site_id] || {};
  const effectiveDailyAvailability = mergeDailyAvailability(siteDailyAvailability, site_id, siteRecurringSessions);

  // Generate slots data for this site
  const slots = enhanceData({
    daily_availability: { [site_id]: effectiveDailyAvailability },
    bookings: { [site_id]: siteBookings }
  });

  // Expose to templates
  res.locals.slots = slots[site_id];
  res.locals.dailyAvailability = effectiveDailyAvailability;
  const allSessionHistory = buildSessionHistory(siteRecurringSessions, from, until, today);
  const allPastSessionHistory = buildPastSessionHistory(siteRecurringSessions, from, until, today);
  const slotsByDate = slots[site_id] || {};
  const mapLegacySummary = (session) => {
    const sessionSlots = asArray(slotsByDate?.[session.date]).filter((slot) => {
      if (slot?.recurringSessionId) {
        return String(slot.recurringSessionId) === String(session.id);
      }

      return slotMatchesSession(slot, {
        id: session.id,
        recurringId: session.id,
        from: session.from,
        until: session.until
      });
    });

    const bookedTotal = sessionSlots.filter((slot) => slot?.booking_status === 'scheduled').length;
    const bookedByService = {};

    asArray(session.services).forEach((serviceId) => {
      bookedByService[serviceId] = 0;
    });

    sessionSlots.forEach((slot) => {
      if (slot?.booking_status !== 'scheduled' || !slot?.booking_id) return;

      const bookedService = siteBookings?.[slot.booking_id]?.service;
      if (!bookedService) return;

      bookedByService[bookedService] = (bookedByService[bookedService] || 0) + 1;
    });

    return {
      ...session,
      bookedTotal,
      unbookedTotal: Math.max(0, sessionSlots.length - bookedTotal),
      bookedByService
    };
  };

  res.locals.sessionHistory = allSessionHistory;
  res.locals.pastSessionHistory = allPastSessionHistory.filter((session) => isSeriesHistoryRow(session));
  res.locals.legacySessionHistory = [
    ...allSessionHistory.filter((session) => session.isLegacy),
    ...allPastSessionHistory.filter((session) => session.isLegacy)
  ].map(mapLegacySummary);

  next();
}

module.exports = { idParamHandler, siteContextMiddleware };
