// -----------------------------------------------------------------------------
// Versions composition
// -----------------------------------------------------------------------------
// Each version of the prototype is a self-contained copy under app/journeys/<vN>/
// (routes + views + helpers), served under a version-prefixed URL via
// versionMiddleware. Versions run side by side for comparison.
//
// To add a new version: `cp -r app/journeys/v1 app/journeys/v2`, then add one
// mount line below. The copied files need no edits — versionMiddleware handles
// the URL/view prefixing.
// -----------------------------------------------------------------------------

const express = require('express');
const router = express.Router();

const versionMiddleware = require('./version-middleware');

const DEFAULT_VERSION = 'v1';

// Back-compat: unversioned app URLs (e.g. old bookmarks, the landing links)
// redirect into the default version.
router.use(['/site', '/sites', '/set-filters'], (req, res) => {
  res.redirect('/' + DEFAULT_VERSION + req.originalUrl);
});

// Mounted versions
router.use('/v1', versionMiddleware('v1'), require('./v1'));
// router.use('/v2', versionMiddleware('v2'), require('./v2'));

module.exports = router;
