const express = require('express');
const router = express.Router();

const { flagsMiddleware } = require('./flags/flags-library');
const { siteLevelMiddleware } = require('./middleware/site-level');
const defaultFlags = require('./flags/defaults');

router.use(flagsMiddleware());
router.use(siteLevelMiddleware());

// feature router FIRST (it self-skips if flag is off)
router.use('/', require('./routes/availabilityGroups'));

//concepts routes
router.use('/', require('./views/concepts/edit-the-blob/routes'));

// base router AFTER
router.use('/', require('./routes/base'));
router.use('/', require('./routes/change-session'));
router.use('/', require('./routes/cancel-availability'));

// flags routes
router.use('/', require('./routes/flags'));



module.exports = router;
