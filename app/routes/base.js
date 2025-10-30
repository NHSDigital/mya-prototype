// ./routes/site/base.js
const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');

const { availabilityGroups } = require('../helpers/availabilityGroups');
const { slotsForDay } = require('../helpers/day');
const { calendar } = require('../helpers/calendar');
const updateDailyAvailability = require('../helpers/updateDailyAvailability');
const slots = require('../helpers/slots');
const enhanceData = require('../helpers/enhanceData');
const { decorateCalendarWithSlots } = require('../helpers/decorateCalendarWithSlots');

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

  if (!data?.sites?.[site_id]) {
    console.warn(`⚠️ Site ${site_id} not found in session data`);
    return res.status(404).send('Site not found');
  }

  // Generate fresh data for this site only
  const slots = enhanceData({
    daily_availability: { [site_id]: data.daily_availability[site_id] },
    bookings: { [site_id]: data.bookings[site_id] }
  });

  // Expose to templates
  res.locals.slots = slots[site_id];

  next();
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
  res.render('site/create-availability/create-availability');
});

router.get('/site/:id/create-availability/type-of-session', (req, res) => {
  res.render('site/create-availability/type-of-session');
});

router.all('/site/:id/create-availability/dates', (req, res) => {
  res.render('site/create-availability/dates');
});

router.all('/site/:id/create-availability/days', (req, res) => {
  res.render('site/create-availability/days');
});

router.all('/site/:id/create-availability/time-and-capacity', (req, res) => {
  res.render('site/create-availability/time-and-capacity');
});

router.all('/site/:id/create-availability/services', (req, res) => {
  res.render('site/create-availability/services');
});

router.all('/site/:id/create-availability/check-answers', (req, res) => {
  res.render('site/create-availability/check-answers');
});

router.get('/site/:id/create-availability/process-new-session', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const newSession = data.newSession;

  if (!newSession) {
    return res.redirect(`/site/${site_id}/create-availability?new-session=false`);
  }

  // Update daily availability for this site
  data.daily_availability = updateDailyAvailability(newSession, data.daily_availability, site_id);
  delete data.newSession;

  res.redirect(`/site/${site_id}/create-availability?new-session=true`);
});


// -----------------------------------------------------------------------------
// VIEW AVAILABILITY
// -----------------------------------------------------------------------------
router.get('/site/:id/availability/day', (req, res) => {
  const date = req.query.date || DateTime.now().toFormat('yyyy-MM-dd');

  res.render('site/availability/day', {
    date,
    isToday: DateTime.now().toFormat('yyyy-MM-dd') === date
  });
});

router.get('/site/:id/change/:type', (req, res) => {
  //pass url params to the template
  const type = req.params.type;

  if (!['session'].includes(type)) {
    return res.status(404).send('Change type not found');
  }

  res.render(`site/change/${type}`, {
    ...req.query
  });
});

router.get('/site/:id/availability/week', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const date = req.query.date || DateTime.now().toFormat('yyyy-MM-dd');

  //return dates for the week containing 'date'
  const week = [];
  const dt = DateTime.fromISO(date);
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
    date,
    week,
    previousWeek,
    nextWeek
  });
});

router.get('/site/:id/availability/all', (req, res) => {
  const site_id = req.site_id;
  const data = req.session.data;
  const today = req.query.today || DateTime.now().toFormat('yyyy-MM-dd'); //start from this date

  res.render('site/availability/all', {
    availabilityGroups: availabilityGroups(data.daily_availability[site_id], today)
  });
});

router.get('/site/:id/availability/all/:groupId', (req, res) => {
  const site_id = req.site_id;
  const data = req.session.data;

  const allGroups = availabilityGroups(data.daily_availability[site_id]);
  const allGroupsArray = [...allGroups.repeating, ...allGroups.single];
  const group = allGroupsArray.find(g => g.id === req.params.groupId);

  if (!group) return res.status(404).send('Availability group not found');

  const today = req.query.today || DateTime.now(); //start from this date
  const rawCalendar = calendar(group.dates);

  res.render('site/availability/group-details', {
    group,
    calendar: rawCalendar,
    today: today.toISODate()
  });
});


// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;
