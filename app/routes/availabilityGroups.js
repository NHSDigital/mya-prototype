const express = require('express');
const router = express.Router();

const { availabilityGroups } = require('../helpers/availabilityGroups');
const { slotsForDay } = require('../helpers/day');
const { calendar } = require('../helpers/calendar');

router.param('id', (req, res, next, id) => {
  req.site_id = id;
  res.locals.site_id = id;
  next();
});

// skip this router entirely when flag is off
router.use((req, res, next) => {
  if (req.features && req.features.availabilityGroups) return next();
  return next('router'); // fall through to next mounted router
});

router.get('/site/:id/availability/day', (req, res) => {
  res.redirect(`/site/${req.site_id}/view-availability/day`);
});

router.get('/site/:id/availability/all', (req, res) => {
  res.render('availabilityGroups/all-availability', {
    availabilityGroups: availabilityGroups(req.session.data.daily_availability[req.site_id], Number(req.site_id)),
  });
});

router.get('/site/:id/availability/all/:groupId', (req, res) => {
  const allGroups = availabilityGroups(req.session.data.daily_availability[req.site_id], Number(req.site_id));
  const allGroupsArray = [...allGroups.repeating, ...allGroups.single];
  const group = allGroupsArray.find(g => g.id === req.params.groupId);

  //get any booked dates for this group
  for (const date of group.dates) {
    group.bookings = group.bookings || {};
    group.bookings[date] = [];
    const bookingsForDay = slotsForDay(req.session.data.daily_availability[date], req.session.data.bookings, Number(req.site_id));
    if (bookingsForDay) {
      group.bookings[date].push(bookingsForDay);
    }
  }

  if (!group) {
    return res.status(404).send('Availability group not found');
  }

  res.render('availabilityGroups/availability-details', {
    group,
    calendar: calendar(group.dates),
  });
});

module.exports = router;
