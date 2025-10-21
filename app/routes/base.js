// ./routes/site/base.js
const express = require('express');
const router = express.Router();
const { weeksInMonth, daysInWeek } = require('../helpers/weekAndMonthViews');
const { slotsForDay } = require('../helpers/day');
const { DateTime } = require('luxon');
const updateDailyAvailability = require('../helpers/updateDailyAvailability');

router.param('id', (req, res, next, id) => {
  req.site_id = id;
  res.locals.site_id = id;
  next();
});

// --- Dashboard ---
router.get('/site/:id', (req, res) => {
  console.log('Dashboard hit — req.site_id:', req.site_id);
  console.log('res.locals.site_id:', res.locals.site_id);

  const data = req.session?.data || {}; // or fake data
  res.render('site/dashboard');
});

// --- Create availability ---
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
  const newSession = req.session.data.newSession;
  if (!newSession) return res.redirect(`/site/${req.site_id}/create-availability?new-session=false`);

  const newDailyAvailability = updateDailyAvailability(
    newSession,
    req.session.data.daily_availability,
    req.site_id
  );

  req.session.data.daily_availability = newDailyAvailability;
  delete req.session.data.newSession;

  res.redirect(`/site/${req.site_id}/create-availability?new-session=true`);
});

// --- View availability ---
function getAvailabilityAndBookings(req) {
  const data = (req.session && req.session.data) || {};
  return { availability: data.availability, bookings: data.bookings };
}

router.get('/site/:id/view-availability', (req, res) => {
  res.redirect(`/site/${req.site_id}/view-availability/week`);
});

router.get('/site/:id/view-availability/week', (req, res) => {
  const date = req.query.date || DateTime.now().toFormat('yyyy-MM-dd');
  const daily_availability = req.session.data.daily_availability;
  const bookings = req.session.data.bookings;
  const siteId = req.site_id != null ? Number(req.site_id) : null;

  const weekDays = daysInWeek(date);
  for (let i = 0; i < weekDays.length; i++) {
    const single_day_availability = daily_availability[DateTime.fromISO(weekDays[i]).toFormat('yyyy-MM-dd')];
    weekDays[i] = {
      date: weekDays[i],
      sessions: slotsForDay(single_day_availability, bookings, siteId, 'service'),
    };
  }

  res.render('site/view-availability/week', {
    monday: weekDays[0].date,
    sunday: weekDays[6].date,
    weekDays,
  });
});

router.get('/site/:id/view-availability/day', (req, res) => {
  const date = req.query.date || DateTime.now().toFormat('yyyy-MM-dd');
  const siteId = req.site_id != null ? Number(req.site_id) : null;
  const daily_availability = req.session.data.daily_availability;
  const bookings = req.session.data.bookings;

  const single_day_availability = daily_availability[date];

  res.render('site/view-availability/day', {
    date,
    sessions: slotsForDay(single_day_availability, bookings, siteId),
    isToday: DateTime.now().toFormat('yyyy-MM-dd') === date,
  });
});

module.exports = router;
