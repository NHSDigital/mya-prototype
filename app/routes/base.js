// ./routes/site/base.js
const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');

const { availabilityGroups } = require('../helpers/availabilityGroups');
const { calendar } = require('../helpers/calendar');
const updateDailyAvailability = require('../helpers/updateDailyAvailability');
const enhanceData = require('../helpers/enhanceData');
const summarise = require('../helpers/summaries');
const compareGroups = require('../helpers/compareGroups');
const removeServicesFromDailyAvailability = require('../helpers/removeDailyAvailability');
const { every } = require('lodash');

const override_today = '2026-09-28'; //for testing purposes

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
  
  //use filters everywhere
  const today = override_today || DateTime.now().toFormat('yyyy-MM-dd');
  const sessionFilters = data.filters?.[site_id] || {};

   // --- Prefer query, then session, then default ---
  const fromDateGroup =
    req.query.fromDateGroup || sessionFilters.fromDateGroup || 'today';
  const untilDateGroup =
    req.query.untilDateGroup || sessionFilters.untilDateGroup || 'none';

  const from =
    req.query.from ||
    sessionFilters.from ||
    (fromDateGroup === 'today' ? today : null);
  const until =
    req.query.until ||
    sessionFilters.until ||
    (untilDateGroup === 'none' ? null : null);

  // --- Normalise: if radio says "today", force from = today, etc. ---
  const resolvedFrom = fromDateGroup === 'today' ? today : from;
  const resolvedUntil = untilDateGroup === 'none' ? null : until;

  // --- Persist back to session ---
  data.filters = data.filters || {};
  data.filters[site_id] = {
    fromDateGroup,
    untilDateGroup,
    from: resolvedFrom,
    until: resolvedUntil
  };

  data.today = today; //expose to session data for convenience


  if (!data?.sites?.[site_id]) {
    console.warn(`⚠️ Site ${site_id} not found in session data`);
    return res.status(404).send('Site not found');
  }

  // Generate slots data for this site
  const slots = enhanceData({
    daily_availability: { [site_id]: data.daily_availability[site_id] },
    bookings: { [site_id]: data.bookings[site_id] }
  });

  //generate groups for this site
  const groupsForThisSite = availabilityGroups(data.daily_availability[site_id], from, until)
  res.locals.availabilityGroups = groupsForThisSite;

  //generate summaries for this site
  const summaries = summarise({
    bookings: data.bookings[site_id],
    availability: data.daily_availability[site_id],
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
  const filters = { ...req.body.filters }

  req.session.data.filters = filters;

  res.redirect(req.body.next);
});

// -----------------------------------------------------------------------------
// All sites (reset any site-specific data)
// -----------------------------------------------------------------------------
router.get('/sites', (req, res) => {
  req.session.data = {};
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
  res.render('site/create-availability/dates');
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
  res.render('site/create-availability/services', {
    ...req.query
  });
});

router.all('/site/:id/create-availability/are-you-assured', (req, res) => {
  res.render('site/create-availability/are-you-assured');
});

router.post('/site/:id/create-availability/check-assurance', (req, res) => {
  const assured = req.body['newSession']['areYouAssured'];

  if (assured === 'yes') {
    return res.redirect(`/site/${req.site_id}/create-availability/check-answers`);
  } else {
    return res.redirect(`/site/${req.site_id}/create-availability/not-assured`);
  }
});

router.all('/site/:id/create-availability/not-assured', (req, res) => {
  res.render('site/create-availability/not-assured');
})

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

  res.redirect(`/site/${site_id}/availability/all?new-session=true`);
});


// -----------------------------------------------------------------------------
// VIEW AVAILABILITY
// -----------------------------------------------------------------------------
router.get('/site/:id/availability/day', (req, res) => {
  const date = req.query.date || override_today || DateTime.now().toFormat('yyyy-MM-dd');

  res.render('site/availability/day', {
    date,
    today: override_today || DateTime.now().toFormat('yyyy-MM-dd'),
    tomorrow: DateTime.fromISO(date).plus({ days: 1 }).toISODate(),
    yesterday: DateTime.fromISO(date).minus({ days: 1 }).toISODate()
  });
});

router.get('/site/:id/availability/week', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const startFromDate = req.query.date || DateTime.now().toFormat('yyyy-MM-dd');
  const today = override_today || DateTime.now().toFormat('yyyy-MM-dd');

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
