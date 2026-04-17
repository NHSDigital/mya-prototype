// ./routes/site/base.js
const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');
const { randomUUID } = require('crypto');

const enhanceData = require('../helpers/enhanceData');
const mergeDailyAvailability = require('../helpers/recurringToDailyAvailability');

const override_today = process.env.OVERRIDE_TODAY || null;

function getToday() {
  return override_today || DateTime.now().toFormat('yyyy-MM-dd');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function normalizeSessionType(type) {
  if (type === 'Single date') return 'Single clinic';
  if (type === 'Weekly session' || type === 'Weekly sessions' || type === 'Weekly repeating') return 'Clinic series';
  return type;
}

function clinicFlowType(data) {
  const type = normalizeSessionType(data?.newSession?.type);
  if (type === 'Single clinic') return 'single';
  if (type === 'Clinic series') return 'series';
  return null;
}

function ensureCreateSession(data) {
  const current = data.newSession || {};
  const sessionType = normalizeSessionType(current.type);

  const session = {
    name: current.name || '',
    type: sessionType || '',
    startDate: {
      day: current.startDate?.day || '',
      month: current.startDate?.month || '',
      year: current.startDate?.year || ''
    },
    endDate: {
      day: current.endDate?.day || '',
      month: current.endDate?.month || '',
      year: current.endDate?.year || ''
    },
    singleDate: {
      day: current.singleDate?.day || '',
      month: current.singleDate?.month || '',
      year: current.singleDate?.year || ''
    },
    days: asArray(current.days),
    startTime: {
      hour: current.startTime?.hour || '',
      minute: current.startTime?.minute || ''
    },
    endTime: {
      hour: current.endTime?.hour || '',
      minute: current.endTime?.minute || ''
    },
    capacity: current.capacity || '',
    duration: current.duration || '',
    services: asArray(current.services),
    closures: asArray(current.closures)
      .filter((closure) => closure?.startDate && closure?.endDate)
      .map((closure) => ({
        startDate: closure.startDate,
        endDate: closure.endDate,
        label: closure.label || ''
      }))
  };

  data.newSession = session;
  return session;
}

function toDateObject(dateInput) {
  const fallback = DateTime.now();

  return {
    day: String(dateInput?.day || fallback.day),
    month: String(dateInput?.month || fallback.month),
    year: String(dateInput?.year || fallback.year)
  };
}

function toTimeString(timeInput) {
  const hour = String(timeInput?.hour || '00').padStart(2, '0');
  const minute = String(timeInput?.minute || '00').padStart(2, '0');
  return `${hour}:${minute}`;
}

function buildPersistableSession(newSession) {
  const mode = normalizeSessionType(newSession.type) || 'Clinic series';
  const isSingleDate = mode === 'Single clinic';
  const startDate = isSingleDate ? toDateObject(newSession.singleDate) : toDateObject(newSession.startDate);
  const endDate = isSingleDate ? toDateObject(newSession.singleDate) : toDateObject(newSession.endDate);
  const startTime = toTimeString(newSession.startTime);
  const endTime = toTimeString(newSession.endTime);

  let days = asArray(newSession.days);
  if (isSingleDate) {
    const iso = `${startDate.year}-${String(startDate.month).padStart(2, '0')}-${String(startDate.day).padStart(2, '0')}`;
    const dt = DateTime.fromISO(iso);
    days = dt.isValid ? [dt.toFormat('cccc')] : [];
  }

  return {
    startDate,
    endDate,
    days,
    startTime: {
      hour: startTime.split(':')[0],
      minute: startTime.split(':')[1]
    },
    endTime: {
      hour: endTime.split(':')[0],
      minute: endTime.split(':')[1]
    },
    services: asArray(newSession.services),
    capacity: Number(newSession.capacity) || 1,
    duration: Number(newSession.duration) || 10
  };
}

function toIsoDate(dateParts) {
  return DateTime.fromObject({
    day: +dateParts.day,
    month: +dateParts.month,
    year: +dateParts.year
  }).toISODate();
}

function toIsoDateIfValid(dateInput) {
  const day = String(dateInput?.day || '').trim();
  const month = String(dateInput?.month || '').trim();
  const year = String(dateInput?.year || '').trim();
  if (!day || !month || !year) return null;

  const dt = DateTime.fromObject({
    day: +day,
    month: +month,
    year: +year
  });

  return dt.isValid ? dt.toISODate() : null;
}

function toDateInputParts(isoDate) {
  const dt = DateTime.fromISO(isoDate || '');
  if (!dt.isValid) {
    return { day: '', month: '', year: '' };
  }

  return {
    day: String(dt.day),
    month: String(dt.month),
    year: String(dt.year)
  };
}

function parseClosureFromBody(closureBody = {}) {
  const label = String(closureBody.name || '').trim();

  const startDate = toIsoDateIfValid(closureBody.startDate);
  const endDate = toIsoDateIfValid(closureBody.endDate);
  if (!startDate || !endDate) return null;

  return {
    startDate,
    endDate,
    label
  };
}

function toEditableClosure(closure = {}) {
  return {
    name: closure.label || '',
    startDate: toDateInputParts(closure.startDate),
    endDate: toDateInputParts(closure.endDate)
  };
}

function toClosureFormInput(input = {}) {
  return {
    name: String(input.name || ''),
    startDate: {
      day: String(input.startDate?.day || ''),
      month: String(input.startDate?.month || ''),
      year: String(input.startDate?.year || '')
    },
    endDate: {
      day: String(input.endDate?.day || ''),
      month: String(input.endDate?.month || ''),
      year: String(input.endDate?.year || '')
    }
  };
}

function toByDay(newSession, startDateISO) {
  const mode = normalizeSessionType(newSession.type) || 'Clinic series';
  if (mode === 'Single clinic') {
    const day = DateTime.fromISO(startDateISO).toFormat('cccc');
    return [day];
  }

  return asArray(newSession.days);
}

function buildSessionLabel(byDay, fromTime) {
  if (!byDay || byDay.length === 0) return `Clinic series ${fromTime}`;
  return `${byDay.join(', ')} clinic series ${fromTime}`;
}

function buildRecurringSessionModel(newSession) {
  const mode = normalizeSessionType(newSession.type) || 'Clinic series';
  const isSingleDate = mode === 'Single clinic';

  const startDateISO = isSingleDate ? toIsoDate(newSession.singleDate) : toIsoDate(newSession.startDate);
  const endDateISO = isSingleDate ? toIsoDate(newSession.singleDate) : toIsoDate(newSession.endDate);
  const byDay = toByDay(newSession, startDateISO);

  const from = toTimeString(newSession.startTime);
  const until = toTimeString(newSession.endTime);
  const slotLength = Number(newSession.duration) || 10;
  const capacity = Number(newSession.capacity) || 1;
  const services = asArray(newSession.services);

  return {
    id: randomUUID().split('-')[0],
    label: (newSession.name || '').trim() || buildSessionLabel(byDay, from),
    startDate: startDateISO,
    endDate: endDateISO,
    recurrencePattern: {
      frequency: 'Weekly',
      interval: 1,
      byDay
    },
    from,
    until,
    slotLength,
    services,
    capacity,
    childSessions: [],
    closures: asArray(newSession.closures)
      .filter((closure) => closure?.startDate && closure?.endDate)
      .map((closure) => ({
        startDate: closure.startDate,
        endDate: closure.endDate,
        label: closure.label || ''
      }))
  };
}

function persistRecurringSession(data, site_id, model) {
  data.recurring_sessions = data.recurring_sessions || {};
  data.recurring_sessions[site_id] = data.recurring_sessions[site_id] || {};
  data.recurring_sessions[site_id][model.id] = model;
}

function buildSessionHistory(siteRecurringSessions, startDate = null, endDate = null, today = null) {
  const rows = [];

  for (const session of Object.values(siteRecurringSessions || {})) {
    const sessionStart = session?.startDate;
    const sessionEnd = session?.endDate || sessionStart;
    if (!sessionStart || !sessionEnd) continue;

    // Keep recurring sessions visible while they are still active.
    if (today && sessionEnd < today) continue;

    // Keep sessions that overlap the requested filter window.
    if (startDate && sessionEnd < startDate) continue;
    if (endDate && sessionStart > endDate) continue;

    rows.push({
      label: session.label,
      date: sessionStart,
      endDate: sessionEnd,
      days: session.recurrencePattern?.byDay || [],
      from: session.from,
      until: session.until,
      services: session.services || [],
      capacity: Number(session.capacity) || 0,
      slotLength: Number(session.slotLength) || 0
    });
  }

  return rows.sort((a, b) => {
    if (a.date === b.date) {
      return (a.from || '').localeCompare(b.from || '');
    }
    return b.date.localeCompare(a.date);
  });
}

function buildPastSessionHistory(siteRecurringSessions, startDate = null, endDate = null, today = null) {
  const rows = [];

  for (const session of Object.values(siteRecurringSessions || {})) {
    const sessionStart = session?.startDate;
    const sessionEnd = session?.endDate || sessionStart;
    if (!sessionStart || !sessionEnd) continue;

    // Keep only sessions that have ended.
    if (!today || sessionEnd >= today) continue;

    if (startDate && sessionEnd < startDate) continue;
    if (endDate && sessionStart > endDate) continue;

    rows.push({
      label: session.label,
      date: sessionStart,
      endDate: sessionEnd,
      days: session.recurrencePattern?.byDay || [],
      from: session.from,
      until: session.until,
      services: session.services || [],
      capacity: Number(session.capacity) || 0,
      slotLength: Number(session.slotLength) || 0
    });
  }

  return rows.sort((a, b) => {
    if (a.endDate === b.endDate) {
      return (a.from || '').localeCompare(b.from || '');
    }
    return b.endDate.localeCompare(a.endDate);
  });
}

// -----------------------------------------------------------------------------
// PARAM HANDLER – capture site_id once for all /site/:id routes
// -----------------------------------------------------------------------------
router.param('id', (req, res, next, id) => {
  req.site_id = id;
  res.locals.site_id = id; // expose to templates
  next();
});


// -----------------------------------------------------------------------------
// MIDDLEWARE – enhance data for the current site before any route runs
// -----------------------------------------------------------------------------
router.use('/site/:id', (req, res, next) => {
  const data = req.session.data;
  const site_id = String(req.site_id);
  const isClinicsCreateFlowPath = /^\/clinics\/(type-of-clinc|details|dates|days|time-and-capacity|clinic-times|appointments-calculator|services|clinic-closures(?:\/.*)?|check-answers|success)$/.test(req.path);

  // Hide top-level navigation on create flow pages to reduce context switching.
  res.locals.hideMainNav = isClinicsCreateFlowPath;

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
  res.locals.sessionHistory = buildSessionHistory(siteRecurringSessions, from, until, today);
  res.locals.pastSessionHistory = buildPastSessionHistory(siteRecurringSessions, from, until, today);

  next();
});

// -----------------------------------------------------------------------------
// SET FILTERS
// -----------------------------------------------------------------------------
router.post('/set-filters', (req, res) => {
  const next = req.body.next || '/sites';
  const site_id = req.body.site_id || req.body.id || req.query.site_id;
  const incomingFilters = req.body.filters || {};

  req.session.data.filters = req.session.data.filters || {};

  if (site_id) {
    req.session.data.filters[String(site_id)] = {
      ...(req.session.data.filters[String(site_id)] || {}),
      from: incomingFilters.from || null,
      until: incomingFilters.until || null
    };
  }

  res.redirect(next);
});

// -----------------------------------------------------------------------------
// All sites (reset any site-specific data)
// -----------------------------------------------------------------------------
router.get('/sites', (req, res) => {
  const transientKeys = [
    'newSession',
    'currentGroup',
    'changeComparison',
    'cancelAvailability',
    'select-date',
    'filters'
  ];

  transientKeys.forEach((key) => {
    delete req.session.data[key];
  });

  res.render('sites');
});


// -----------------------------------------------------------------------------
// DASHBOARD
// -----------------------------------------------------------------------------
router.get('/site/:id', (req, res) => {
  res.render('site/dashboard');
});


// -----------------------------------------------------------------------------
// CLINICS
// -----------------------------------------------------------------------------
router.get('/site/:id/clinics', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/clinics');
});

router.all('/site/:id/clinics/type-of-session', (req, res) => {
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc${query}`);
});

router.all('/site/:id/clinics/type-of-clinc', (req, res) => {
  if (req.method === 'GET' && req.query.new === '1') {
    delete req.session.data.newSession;
  }

  ensureCreateSession(req.session.data);
  res.render('site/clinics/type-of-clinc');
});

router.all('/site/:id/clinics/dates', (req, res) => {
  return res.redirect(`/site/${req.site_id}/clinics/details`);
});

router.all('/site/:id/clinics/details', (req, res) => {
  ensureCreateSession(req.session.data);

  const flowType = clinicFlowType(req.session.data);
  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  return res.render(`site/clinics/${flowType}/details`);
});

router.all('/site/:id/clinics/days', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  if (flowType === 'single') {
    return res.redirect(`/site/${req.site_id}/clinics/clinic-times`);
  }

  return res.render('site/clinics/series/days');
});

router.all('/site/:id/clinics/time-and-capacity', (req, res) => {
  return res.redirect(`/site/${req.site_id}/clinics/clinic-times`);
});

router.all('/site/:id/clinics/clinic-times', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  return res.render(`site/clinics/${flowType}/clinic-times`);
});

router.all('/site/:id/clinics/appointments-calculator', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  return res.render(`site/clinics/${flowType}/appointments-calculator`);
});

router.all('/site/:id/clinics/services', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  res.render(`site/clinics/${flowType}/services`, {
    ...req.query
  });
});

router.all('/site/:id/clinics/clinic-closures', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  const closures = req.session.data.newSession.closures || [];

  if (req.method === 'POST') {
    const addAnother = req.body?.addAnother;
    if (addAnother === 'yes') {
      return res.redirect(`/site/${req.site_id}/clinics/clinic-closures/add`);
    }

    if (addAnother === 'no') {
      return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
    }

    // Initial POST from services (or no radio selection) should stay on this page.
    return res.render('site/clinics/series/clinic-closures', {
      closures
    });
  }

  return res.render('site/clinics/series/clinic-closures', {
    closures
  });
});

router.all('/site/:id/clinics/clinic-closures/add', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  if (req.method === 'POST') {
    const parsed = parseClosureFromBody(req.body?.closure || {});
    if (!parsed) {
      return res.render('site/clinics/series/clinic-closures-form', {
        mode: 'add',
        closure: toClosureFormInput(req.body?.closure || {}),
        actionHref: `/site/${req.site_id}/clinics/clinic-closures/add`,
        error: 'Enter valid closure start and end dates'
      });
    }

    req.session.data.newSession.closures = req.session.data.newSession.closures || [];
    req.session.data.newSession.closures.push(parsed);
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  return res.render('site/clinics/series/clinic-closures-form', {
    mode: 'add',
    closure: toClosureFormInput({
      name: '',
      startDate: { day: '', month: '', year: '' },
      endDate: { day: '', month: '', year: '' }
    }),
    actionHref: `/site/${req.site_id}/clinics/clinic-closures/add`
  });
});

router.all('/site/:id/clinics/clinic-closures/:index/change', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  const index = Number(req.params.index);
  const closures = req.session.data.newSession.closures || [];
  const current = closures[index];

  if (!Number.isInteger(index) || index < 0 || !current) {
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  if (req.method === 'POST') {
    const parsed = parseClosureFromBody(req.body?.closure || {});
    if (!parsed) {
      return res.render('site/clinics/series/clinic-closures-form', {
        mode: 'change',
        closure: toClosureFormInput(req.body?.closure || toEditableClosure(current)),
        actionHref: `/site/${req.site_id}/clinics/clinic-closures/${index}/change`,
        error: 'Enter valid closure start and end dates'
      });
    }

    closures[index] = parsed;
    req.session.data.newSession.closures = closures;
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  return res.render('site/clinics/series/clinic-closures-form', {
    mode: 'change',
    closure: toClosureFormInput(toEditableClosure(current)),
    actionHref: `/site/${req.site_id}/clinics/clinic-closures/${index}/change`
  });
});

router.all('/site/:id/clinics/clinic-closures/:index/remove', (req, res) => {
  ensureCreateSession(req.session.data);
  let flowType = clinicFlowType(req.session.data);

  if (flowType !== 'series') {
    const postedType = normalizeSessionType(req.body?.newSession?.type);
    if (postedType === 'Clinic series') {
      req.session.data.newSession = req.session.data.newSession || {};
      req.session.data.newSession.type = 'Clinic series';
      flowType = 'series';
    }
  }

  if (flowType !== 'series') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  }

  const index = Number(req.params.index);
  const closures = req.session.data.newSession.closures || [];
  const current = closures[index];

  if (!Number.isInteger(index) || index < 0 || !current) {
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  if (req.method === 'POST') {
    closures.splice(index, 1);
    req.session.data.newSession.closures = closures;
    return res.redirect(`/site/${req.site_id}/clinics/clinic-closures`);
  }

  return res.render('site/clinics/series/clinic-closures-remove', {
    index,
    closure: current
  });
});

router.all('/site/:id/clinics/check-answers', (req, res) => {
  ensureCreateSession(req.session.data);
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`);
  }

  res.render(`site/clinics/${flowType}/check-answers`);
});

router.all('/site/:id/clinics/process-new-session', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const newSession = ensureCreateSession(data);

  if (!newSession) {
    return res.redirect(`/site/${site_id}/clinics?new-session=false`);
  }

  const recurringSession = buildRecurringSessionModel(newSession);
  persistRecurringSession(data, site_id, recurringSession);
  delete data.newSession;

  res.redirect(`/site/${site_id}/clinics/success`);
});

router.get('/site/:id/clinics/success', (req, res) => {
  const flowType = clinicFlowType(req.session.data);

  if (!flowType) {
    return res.render('site/clinics/series/success');
  }

  res.render(`site/clinics/${flowType}/success`);
});

// Legacy create-availability URLs
router.get('/site/:id/create-availability', (req, res) => res.redirect(`/site/${req.site_id}/clinics`));
router.all('/site/:id/create-availability/type-of-session', (req, res) => res.redirect(`/site/${req.site_id}/clinics/type-of-clinc`));
router.all('/site/:id/create-availability/dates', (req, res) => res.redirect(`/site/${req.site_id}/clinics/details`));
router.all('/site/:id/create-availability/days', (req, res) => res.redirect(`/site/${req.site_id}/clinics/days`));
router.all('/site/:id/create-availability/time-and-capacity', (req, res) => res.redirect(`/site/${req.site_id}/clinics/clinic-times`));
router.all('/site/:id/create-availability/services', (req, res) => res.redirect(`/site/${req.site_id}/clinics/services`));
router.all('/site/:id/create-availability/clinic-closures', (req, res) => res.redirect(`/site/${req.site_id}/clinics/clinic-closures`));
router.all('/site/:id/create-availability/check-answers', (req, res) => res.redirect(`/site/${req.site_id}/clinics/check-answers`));
router.all('/site/:id/create-availability/process-new-session', (req, res) => res.redirect(`/site/${req.site_id}/clinics/process-new-session`));
router.get('/site/:id/create-availability/success', (req, res) => res.redirect(`/site/${req.site_id}/clinics/success`));

router.get('/site/:id/debug/recurring-expansion', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const recurringSessions = data?.recurring_sessions?.[site_id] || {};
  const records = Object.values(recurringSessions);

  const requestedId = req.query.id;
  const selected = records.find((session) => session.id === requestedId) || records[0] || null;
  const expandedDates = [];

  if (selected) {
    for (const [date, day] of Object.entries(res.locals.dailyAvailability || {})) {
      const hasMatch = (day.sessions || []).some((session) => session.recurringId === selected.id);
      if (hasMatch) expandedDates.push(date);
    }
  }

  expandedDates.sort();

  res.render('site/debug/recurring-expansion', {
    sessionCount: records.length,
    selected,
    expandedDates,
    selectedJson: selected ? JSON.stringify(selected, null, 2) : ''
  });
});


// -----------------------------------------------------------------------------
// VIEW AVAILABILITY
// -----------------------------------------------------------------------------
router.get('/site/:id/availability/day', (req, res) => {
  const date = req.query.date || getToday();

  res.render('site/availability/day', {
    date,
    today: getToday(),
    tomorrow: DateTime.fromISO(date).plus({ days: 1 }).toISODate(),
    yesterday: DateTime.fromISO(date).minus({ days: 1 }).toISODate()
  });
});

router.get('/site/:id/availability/week', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const startFromDate = req.query.date || getToday();
  const today = getToday();

  //return dates for the week containing 'date'
  const week = [];
  const dt = DateTime.fromISO(startFromDate);
  const startOfWeek = dt.startOf('week'); //assuming week starts on Monday
  for (let i = 0; i < 7; i++) {
    week.push(startOfWeek.plus({ days: i }).toISODate());
  }

  //return previous and next week dates
  const previousWeek = {
    start:startOfWeek.minus({ days: 7 }).toISODate(), //previous Monday
    end: startOfWeek.minus({ days: 1 }).toISODate() //previous Sunday
  }
  const nextWeek = {
    start: startOfWeek.plus({ days: 7 }).toISODate(), //next Monday
    end: startOfWeek.plus({ days: 13 }).toISODate() //next Sunday
  }


  res.render('site/availability/week', {
    date: startFromDate,
    today,
    week,
    previousWeek,
    nextWeek
  });
});

router.get('/site/:id/availability/month', (req, res) => { 
  res.redirect('/not-in-this-prototype');
  //res.render('site/availability/month');
});

router.get('/site/:id/availability/all', (req, res) => { 
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.get('/site/:id/availability/all/:groupId', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// REMOVE GROUP or SESSION
// -----------------------------------------------------------------------------
router.all('/site/:id/remove/:itemId', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/remove/:itemId/do-you-want-to-cancel-bookings', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/remove/:itemId/check-answers', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/remove/:itemId/success', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// CONFIRM REMOVE
// -----------------------------------------------------------------------------
router.get('/site/:id/remove/:itemId/confirm-remove', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// CHANGE GROUP
// -----------------------------------------------------------------------------

router.all('/site/:id/change/group/:itemId', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

router.all('/site/:id/change/group/:itemId/:step', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;
