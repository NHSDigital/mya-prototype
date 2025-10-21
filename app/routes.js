const express = require('express');
const router = express.Router();

const { flagsMiddleware } = require('./flags/flags-library');
const { siteLevelMiddleware } = require('./middleware/site-level');
const defaultFlags = require('./flags/defaults');

router.use(flagsMiddleware());
router.use(siteLevelMiddleware());

if (defaultFlags.availabilityGroups) {
  router.use('/', require('./routes/availabilityGroups'));
}

router.use('/', require('./routes/base'));

module.exports = router;
