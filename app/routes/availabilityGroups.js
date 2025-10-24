const express = require('express');
const router = express.Router();

const { availabilityGroups } = require('../helpers/availabilityGroups');
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

router.get('/site/:id/view-availability', (req, res) => {
  res.render('availabilityGroups/availability', {
    availabilityGroups: availabilityGroups(req.session.data.daily_availability, Number(req.site_id)),
  });
});

router.get('/site/:id/view-availability/:groupId', (req, res) => {
  const allGroups = availabilityGroups(req.session.data.daily_availability, Number(req.site_id));
  const allGroupsArray = [...allGroups.repeating, ...allGroups.single]
  const group = allGroupsArray.find(g => g.id === req.params.groupId);

  if (!group) {
    return res.status(404).send('Availability group not found');
  }

  res.render('availabilityGroups/availability-details', {
    group,
    calendar: calendar(group.dates),
  });
});

module.exports = router;
