const express = require('express');
const router = express.Router();

const { flagsMiddleware } = require('./flags/flags-library');
const { siteLevelMiddleware } = require('./middleware/site-level');

router.use(flagsMiddleware());
router.use(siteLevelMiddleware());

// All journeys (and, during migration, the legacy route files) are composed here.
router.use('/', require('./journeys'));



module.exports = router;
