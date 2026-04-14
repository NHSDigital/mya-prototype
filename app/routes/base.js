// ./routes/site/base.js
const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');

const updateDailyAvailability = require('../helpers/updateDailyAvailability');
const enhanceData = require('../helpers/enhanceData');

const override_today = process.env.OVERRIDE_TODAY || null;

function getToday() {
  return override_today || DateTime.now().toFormat('yyyy-MM-dd');
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function ensureCreateSession(data) {
  const current = data.newSession || {};

  const session = {
    type: current.type || 'Weekly session',
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
  const mode = newSession.type || 'Weekly session';
  const isSingleDate = mode === 'Single date';
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

function buildSessionHistory(siteDailyAvailability, startDate = null, endDate = null, today = null) {
  const rows = [];

  for (const day of Object.values(siteDailyAvailability || {})) {
    const date = day?.date;
    if (!date) continue;
    if (today && date < today) continue;
    if (startDate && date < startDate) continue;
    if (endDate && date > endDate) continue;

    for (const session of (day.sessions || [])) {
      rows.push({
        date,
        from: session.from,
        until: session.until,
        services: session.services || [],
        capacity: Number(session.capacity) || 0,
        slotLength: Number(session.slotLength) || 0
      });
    }
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
  const siteBookings = data.bookings?.[site_id] || {};

  // Generate slots data for this site
  const slots = enhanceData({
    daily_availability: { [site_id]: siteDailyAvailability },
    bookings: { [site_id]: siteBookings }
  });

  // Expose to templates
  res.locals.slots = slots[site_id];
  res.locals.sessionHistory = buildSessionHistory(siteDailyAvailability, from, until, today);

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
// CREATE AVAILABILITY
// -----------------------------------------------------------------------------
router.get('/site/:id/create-availability', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/create-availability');
});

router.all('/site/:id/create-availability/type-of-session', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/type-of-session');
});

router.all('/site/:id/create-availability/dates', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/dates');
});

router.all('/site/:id/create-availability/days', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/days');
});

router.all('/site/:id/create-availability/time-and-capacity', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/time-and-capacity');
});

router.all('/site/:id/create-availability/services', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/services', {
    ...req.query
  });
});

router.all('/site/:id/create-availability/are-you-assured', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/are-you-assured');
});

router.post('/site/:id/create-availability/check-assurance', (req, res) => {
  ensureCreateSession(req.session.data);
  const assured = req.body?.newSession?.areYouAssured || req.session.data.newSession.areYouAssured;

  if (assured === 'yes') {
    return res.redirect(`/site/${req.site_id}/create-availability/check-answers`);
  } else {
    return res.redirect(`/site/${req.site_id}/create-availability/not-assured`);
  }
});

router.all('/site/:id/create-availability/not-assured', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/not-assured');
})

router.all('/site/:id/create-availability/check-answers', (req, res) => {
  ensureCreateSession(req.session.data);
  res.render('site/create-availability/check-answers');
});

router.all('/site/:id/create-availability/process-new-session', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const newSession = ensureCreateSession(data);

  if (!newSession) {
    return res.redirect(`/site/${site_id}/create-availability?new-session=false`);
  }

  const persistableSession = buildPersistableSession(newSession);

  // Update daily availability for this site
  data.daily_availability = updateDailyAvailability(persistableSession, data.daily_availability, site_id);
  delete data.newSession;

  res.redirect(`/site/${site_id}/create-availability/success`);
});

router.get('/site/:id/create-availability/success', (req, res) => {
  res.render('site/create-availability/success');
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

router.all('/site/:id/change/group/:itemId/:step?', (req, res) => {
  res.redirect(`/site/${req.site_id}/create-availability`);
});

// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;
