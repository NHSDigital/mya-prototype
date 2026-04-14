// ./routes/site/base.js
const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');

const { availabilityGroups } = require('../helpers/availabilityGroups');
const updateDailyAvailability = require('../helpers/updateDailyAvailability');
const enhanceData = require('../helpers/enhanceData');
const summarise = require('../helpers/summaries');
const compareGroups = require('../helpers/compareGroups');

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
  return {
    day: String(dateInput?.day || ''),
    month: String(dateInput?.month || ''),
    year: String(dateInput?.year || '')
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

  //generate groups for this site
  const groupsForThisSite = availabilityGroups(siteDailyAvailability, from, until)
  res.locals.availabilityGroups = groupsForThisSite;

  //generate summaries for this site
  const summaries = summarise({
    bookings: siteBookings,
    availability: siteDailyAvailability,
    groups: groupsForThisSite.repeating.concat(groupsForThisSite.single)
  });
  res.locals.summaries = summaries;

  // Expose to templates
  res.locals.slots = slots[site_id];

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
  res.render('site/create-availability/dates');
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

router.get('/site/:id/create-availability/process-new-session', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const newSession = ensureCreateSession(data);

  if (!newSession) {
    return res.redirect(`/site/${site_id}/create-availability?new-session=false`);
  }

  const persistableSession = buildPersistableSession(newSession);

  if (!persistableSession.startDate.year || !persistableSession.endDate.year) {
    return res.redirect(`/site/${site_id}/create-availability/dates`);
  }

  // Update daily availability for this site
  data.daily_availability = updateDailyAvailability(persistableSession, data.daily_availability, site_id);
  delete data.newSession;

  res.redirect(`/site/${site_id}/availability/all?new-session=true`);
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
  res.render('site/availability/all', {
    startDateGroup: req.query.startDateGroup || null,
    endDateGroup: req.query.endDateGroup || null,
    newSession: req.query['new-session'] === 'true'
  });
});

router.get('/site/:id/availability/all/:groupId', (req, res) => {

  //This is where we start editing journeys
  //So we need to copy the selected group into session data
  //That way, we always have access to the session we're editing
  //without relying on query params or similar
  const currentGroup = res.locals.availabilityGroups.repeating.concat(res.locals.availabilityGroups.single)
    .find(g => g.id === req.params.groupId);

  req.session.data.currentGroup = JSON.parse(JSON.stringify(currentGroup));

  res.render('site/availability/group-details', {
    group: currentGroup
  });
});

// -----------------------------------------------------------------------------
// REMOVE GROUP or SESSION
// -----------------------------------------------------------------------------
router.get('/site/:id/remove/:itemId', (req, res) => {
  const itemId = req.params.itemId;

  //get the group (not session) being removed
  const group = res.locals.availabilityGroups.repeating
    .find(g => g.id === itemId)

  res.render('site/remove/select-availability', {
    group,
    itemId
  });

});

router.all('/site/:id/remove/:itemId/do-you-want-to-cancel-bookings', (req, res) => {
  const itemId = req.params.itemId;

  //get the group (not session) being removed
  const group = res.locals.availabilityGroups.repeating
    .find(g => g.id === itemId)
  
  res.render('site/remove/do-you-want-to-cancel-bookings', {
    group,
    itemId
  });
});

router.all('/site/:id/remove/:itemId/check-answers', (req, res) => {
  const itemId = req.params.itemId;

  //get the group (not session) being removed
  const group = res.locals.availabilityGroups.repeating
    .find(g => g.id === itemId)
  
  res.render('site/remove/check-answers', {
    group,
    itemId
  });
});

router.all('/site/:id/remove/:itemId/success', (req, res) => {
  const itemId = req.params.itemId;

  //remove all matched dates from session
  const data = req.session.data;
  data['select-date'] = {};

  res.render('site/remove/success', {
    itemId
  });
});

// -----------------------------------------------------------------------------
// CONFIRM REMOVE
// -----------------------------------------------------------------------------
router.get('/site/:id/remove/:itemId/confirm-remove', (req, res) => {
  res.render('site/remove/confirm-remove', {
    itemId: req.params.itemId
  });
});

// -----------------------------------------------------------------------------
// CHANGE GROUP
// -----------------------------------------------------------------------------

router.get('/site/:id/change/:type/:itemId/time-or-capacity', (req, res) => {
  res.render('site/change/time-or-capacity', {
    type: req.params.type,
    itemId: req.params.itemId
  });
});

router.get('/site/:id/change/:type/:itemId/services', (req, res) => {
  res.render('site/change/services', {
    type: req.params.type,
    itemId: req.params.itemId
  });
});

router.post('/site/:id/change/:type/:itemId/do-you-want-to-cancel-bookings', (req, res) => {

  //compare groups and identify affected bookings
  const data = req.session.data;
  const site_id = req.site_id;
  const editedGroup = data.currentGroup;
  const originalGroup = res.locals.availabilityGroups.repeating.concat(res.locals.availabilityGroups.single)
    .find(g => g.id === req.params.itemId);

  const differences = compareGroups(originalGroup, editedGroup, data.bookings[site_id] || []);

  //store comparison results in session data for later steps
  data.changeComparison = differences;
  req.session.data = data; //persist back to session

  if(differences.counts.totalAffected === 0) {
    //no affected bookings – skip to check answers
    return res.redirect(`/site/${site_id}/change/${req.params.type}/${req.params.itemId}/check-answers`);
  } 

  //redirect to do-you-want-to-cancel-bookings page
  res.redirect(`/site/${site_id}/change/${req.params.type}/${req.params.itemId}/do-you-want-to-cancel-bookings`);
});

router.get('/site/:id/change/:type/:itemId/do-you-want-to-cancel-bookings', (req, res) => {
    const type = req.params.type;
    const itemId = req.params.itemId;

    res.render('site/change/do-you-want-to-cancel-bookings', {
      type,
      itemId
    });
  }
);

//GET route for do-you-want-to-cancel-bookings to allow users to go back and change their answer
router.get('/site/:id/change/:type/:itemId/do-you-want-to-cancel-bookings', (req, res) => {
  res.render('site/change/do-you-want-to-cancel-bookings', {
    type: req.params.type,
    itemId: req.params.itemId
  });
});

router.all('/site/:id/change/:type/:itemId/check-answers', (req, res) => {
  console.log('Route hit!', req.params);
  res.render('site/change/check-answers', {
    type: req.params.type,
    itemId: req.params.itemId

  });
});

router.post('/site/:id/change/:type/:itemId/confirm-change', (req, res) => {
  res.redirect(`/site/${req.params.id}/change/${req.params.type}/${req.params.itemId}/success`);
});

router.get('/site/:id/change/:type/:itemId/success', (req, res) => {
  res.render('site/change/success');
});

// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;
