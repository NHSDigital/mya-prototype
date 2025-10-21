const express = require('express');
const router = express.Router();

router.param('id', (req, res, next, id) => {
  req.site_id = id;
  res.locals.site_id = id;
  next();
});

router.get('/site/:id/view-availability', (req, res) => {
  res.render('availabilityGroups/availability')
});

module.exports = router;
