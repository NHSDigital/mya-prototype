const express = require('express');
const router = express.Router();

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

  if(typeOfChange === 'time-or-capacity') {
    return res.redirect(`/not-in-this-prototype`);
  }

  if(typeOfChange === 'services') {
    return res.redirect(`/not-in-this-prototype`);
  }

  if(typeOfChange === 'cancel') {
    //add current daily availability to session data for comparison later
    let currentGroup = null;
    for(const day of Object.values(req.session.data.daily_availability[site_id])) {
      for(session of day.sessions) {
        if(session.id === itemId) {
          currentGroup = {
            dates: [day.date],
            ...session
          };
          break;
        }
      }
      if(currentGroup) break;
    }
    
    req.session.data.currentGroup = JSON.parse(JSON.stringify(currentGroup));
    return res.redirect(`/site/${site_id}/change/${type}/${itemId}/is-this-part-of-a-group`);
  }
});

router.get('/site/:id/change/:type/:itemId/is-this-part-of-a-group', (req, res) => {
  //determine if the item is part of a group
  const site_id = req.site_id;
  const itemId = req.params.itemId;

  const isPartOfGroup = res.locals.availabilityGroups.repeating
    .some(g => g.sessionIds.includes(itemId));

  if(isPartOfGroup) {
    return res.redirect(`/site/${site_id}/change/${req.params.type}/${itemId}/matching-availability`);
  }

  res.redirect(`/site/${site_id}/change/${req.params.type}/${itemId}/do-you-want-to-cancel-bookings-single`);
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
  if(changeMatchingAvailability === 'true') {
    return res.redirect(`/site/${req.site_id}/change/${req.params.type}/${req.params.itemId}/select-matching-availability`);
  }

  res.redirect(`/site/${req.site_id}/change/${req.params.type}/${req.params.itemId}/do-you-want-to-cancel-bookings-single`);
});

router.get('/site/:id/change/:type/:itemId/select-matching-availability', (req, res) => {
  //return id of group containing this session
  const group = res.locals.availabilityGroups.repeating
    .find(g => g.sessionIds.includes(req.params.itemId));
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