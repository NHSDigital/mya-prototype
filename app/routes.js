const express = require('express');
const router = express.Router();

const { flagsMiddleware } = require('./flags/flags-library');
const { siteLevelMiddleware } = require('./middleware/site-level');
const { screenshotDataMiddleware } = require('./middleware/screenshot-data');

router.use(flagsMiddleware());
router.use(siteLevelMiddleware());

// Hydrate session data from the x-journey-screenshot-data header (used by the
// screenshot capture script) BEFORE journeys / site-context run.
router.use(screenshotDataMiddleware);

// The /map documentation site (live Express + Nunjucks). Mounted outside the
// version middleware so its own URLs are not version-prefixed.
router.use('/', require('./map/routes'));

// All journeys are composed here.
router.use('/', require('./journeys'));



module.exports = router;
