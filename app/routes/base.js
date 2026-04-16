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
  return type || 'Clinic series';
}

function ensureCreateSession(data) {
  const current = data.newSession || {};
  const sessionType = normalizeSessionType(current.type);

  const session = {
    type: sessionType,
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
      hour: current.startTime?.hour || '09',
      minute: current.startTime?.minute || '00'
    },
    endTime: {
      hour: current.endTime?.hour || '17',
      minute: current.endTime?.minute || '00'
    },
    capacity: current.capacity || '1',
    duration: current.duration || '10',
    services: asArray(current.services),
    areYouAssured: current.areYouAssured || ''
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
  const mode = normalizeSessionType(newSession.type);
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

function toByDay(newSession, startDateISO) {
  const mode = normalizeSessionType(newSession.type);
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
  const mode = normalizeSessionType(newSession.type);
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
    label: buildSessionLabel(byDay, from),
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
    exclusionTimes: [],
    exclusionDateRanges: [],
    overrideDates: []
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
      date: sessionStart,
      endDate: sessionEnd,
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
  ensureCreateSession(req.session.data);
  res.render('site/clinics/type-of-session');
});

router.all('/site/:id/clinics/dates', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/dates');
});

router.all('/site/:id/clinics/days', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/days');
});

router.all('/site/:id/clinics/time-and-capacity', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/time-and-capacity');
});

router.all('/site/:id/clinics/services', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/services', {
    ...req.query
  });
});

router.all('/site/:id/clinics/are-you-assured', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/are-you-assured');
});

router.post('/site/:id/clinics/check-assurance', (req, res) => {
  ensureCreateSession(req.session.data);
  const assured = req.body?.newSession?.areYouAssured || req.session.data.newSession.areYouAssured;

  if (assured === 'yes') {
    return res.redirect(`/site/${req.site_id}/clinics/check-answers`);
  } else {
    return res.redirect(`/site/${req.site_id}/clinics/not-assured`);
  }
});

router.all('/site/:id/clinics/not-assured', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/not-assured');
})

router.all('/site/:id/clinics/check-answers', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/clinics/check-answers');
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
  res.render('site/clinics/success');
});

// Legacy create-availability URLs
router.get('/site/:id/create-availability', (req, res) => res.redirect(`/site/${req.site_id}/clinics`));
router.all('/site/:id/create-availability/type-of-session', (req, res) => res.redirect(`/site/${req.site_id}/clinics/type-of-session`));
router.all('/site/:id/create-availability/dates', (req, res) => res.redirect(`/site/${req.site_id}/clinics/dates`));
router.all('/site/:id/create-availability/days', (req, res) => res.redirect(`/site/${req.site_id}/clinics/days`));
router.all('/site/:id/create-availability/time-and-capacity', (req, res) => res.redirect(`/site/${req.site_id}/clinics/time-and-capacity`));
router.all('/site/:id/create-availability/services', (req, res) => res.redirect(`/site/${req.site_id}/clinics/services`));
router.all('/site/:id/create-availability/are-you-assured', (req, res) => res.redirect(`/site/${req.site_id}/clinics/are-you-assured`));
router.all('/site/:id/create-availability/check-answers', (req, res) => res.redirect(`/site/${req.site_id}/clinics/check-answers`));
router.all('/site/:id/create-availability/not-assured', (req, res) => res.redirect(`/site/${req.site_id}/clinics/not-assured`));
router.post('/site/:id/create-availability/check-assurance', (req, res) => res.redirect(`/site/${req.site_id}/clinics/check-assurance`));
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
