const express = require('express');
const router = express.Router();

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
  res.render('availabilityGroups/availability')
});

module.exports = router;
