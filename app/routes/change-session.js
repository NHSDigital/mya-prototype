const express = require('express');
const router = express.Router();

function getRepeatingGroups(res) {
  return res.locals.availabilityGroups?.repeating || [];
}

function findSessionSnapshot(data, siteId, itemId) {
  const siteAvailability = data?.daily_availability?.[siteId] || {};

  for (const day of Object.values(siteAvailability)) {
    for (const session of (day.sessions || [])) {
      if (session.id === itemId) {
        return {
          dates: [day.date],
          ...session
        };
      }
    }
  }

  return null;
}

router.param('id', (req, res, next, id) => {
  req.site_id = id;
  res.locals.site_id = id;
  next();
});

// -----------------------------------------------------------------------------
// CHANGE SINGLE SESSION
// -----------------------------------------------------------------------------
router.get('/site/:id/change/:type/:itemId', (req, res) => {
  res.render(`site/change-${req.params.type}/index`, {
    type: req.params.type,
    itemId: req.params.itemId
  });
});

router.post('/site/:id/change/:type/:itemId/select-type-of-change', (req, res) => {
  const typeOfChange = req.body['type-of-change'];
  const site_id = req.site_id;
  const itemId = req.params.itemId;
  const type = req.params.type;

  if (typeOfChange === 'time-or-capacity') {
    return res.redirect(`/not-in-this-prototype`);
  }

  if (typeOfChange === 'services') {
    return res.redirect(`/not-in-this-prototype`);
  }

  if (typeOfChange === 'cancel') {
    req.session.data = req.session.data || {};
    const currentGroup = findSessionSnapshot(req.session.data, site_id, itemId);

    if (!currentGroup) {
      return res.redirect(`/site/${site_id}/availability/all`);
    }

    req.session.data.currentGroup = JSON.parse(JSON.stringify(currentGroup));
    return res.redirect(`/site/${site_id}/change/${type}/${itemId}/is-this-part-of-a-group`);
  }

  return res.redirect(`/site/${site_id}/change/${type}/${itemId}`);
});

router.get('/site/:id/change/:type/:itemId/is-this-part-of-a-group', (req, res) => {
  const site_id = req.site_id;
  const itemId = req.params.itemId;

  const isPartOfGroup = getRepeatingGroups(res)
    .some((g) => g.sessionIds.includes(itemId));

  if (isPartOfGroup) {
    return res.redirect(`/site/${site_id}/change/${req.params.type}/${itemId}/matching-availability`);
  }

  return res.redirect(`/site/${site_id}/change/${req.params.type}/${itemId}/do-you-want-to-cancel-bookings-single`);
});

router.get('/site/:id/change/:type/:itemId/matching-availability', (req, res) => {
  res.render('site/change-session/matching-availability', {
    type: req.params.type,
    itemId: req.params.itemId
  });
});

router.get('/site/:id/change/:type/:itemId/do-you-want-to-cancel-bookings-single', (req, res) => {
  res.render('site/change-session/do-you-want-to-cancel-bookings-single', {
    type: req.params.type,
    itemId: req.params.itemId
  });
});

router.post('/site/:id/change/:type/:itemId/change-matching-availability', (req, res) => {
  const changeMatchingAvailability = req.body['change-matching-availability'];

  if (changeMatchingAvailability === 'true' || changeMatchingAvailability === true) {
    return res.redirect(`/site/${req.site_id}/change/${req.params.type}/${req.params.itemId}/select-matching-availability`);
  }

  return res.redirect(`/site/${req.site_id}/change/${req.params.type}/${req.params.itemId}/do-you-want-to-cancel-bookings-single`);
});

router.get('/site/:id/change/:type/:itemId/select-matching-availability', (req, res) => {
  const group = getRepeatingGroups(res)
    .find((g) => g.sessionIds.includes(req.params.itemId));

  res.render('site/change-session/select-matching-availability', {
    type: req.params.type,
    itemId: req.params.itemId,
    group
  });
});

router.get('/site/:id/change/:type/:itemId/check-answers-single', (req, res) => {
  res.render('site/change-session/check-answers-single', {
    type: req.params.type,
    itemId: req.params.itemId
  });
});

router.get('/site/:id/change/:type/:itemId/success-single', (req, res) => {
  res.render('site/change-session/success-single', {
    type: req.params.type,
    itemId: req.params.itemId
  });
});



// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;