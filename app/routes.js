const express = require('express');
const router = express.Router();

const { flagsMiddleware } = require('./flags/flags-library');
const { siteLevelMiddleware } = require('./middleware/site-level');

router.use(flagsMiddleware());
router.use(siteLevelMiddleware());

// base router AFTER
router.use('/', require('./routes/base'));
router.use('/', require('./routes/change-session'));
router.use('/', require('./routes/cancel-a-date-range'));
router.use('/', require('../map/router'));



module.exports = router;
