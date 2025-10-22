const express = require('express');
const router = express.Router();

const { flagsMiddleware } = require('./flags/flags-library');
const { siteLevelMiddleware } = require('./middleware/site-level');
const defaultFlags = require('./flags/defaults');

router.use(flagsMiddleware());
router.use(siteLevelMiddleware());

// feature router FIRST (it self-skips if flag is off)
router.use('/', require('./routes/availabilityGroups'));

// base router AFTER
router.use('/', require('./routes/base'));

// flags routes
router.use('/', require('./routes/flags'));

module.exports = router;
