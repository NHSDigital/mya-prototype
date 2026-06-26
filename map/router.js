const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const { ensureMapBuilt } = require('./build');

const router = express.Router();
const distDir = path.join(__dirname, 'dist');
const indexPath = path.join(distDir, 'index.html');
const buildMode = process.env.MAP_BUILD_MODE || 'static';

function ensureBuiltMiddleware(req, res, next) {
  if (buildMode === 'static') {
    if (!fs.existsSync(indexPath)) {
      next(
        new Error(
          'The /map site is configured for static serving but map/dist/index.html is missing. Run `npm run map:build` during deploy or startup, or set MAP_BUILD_MODE=runtime.'
        )
      );
      return;
    }

    next();
    return;
  }

  try {
    ensureMapBuilt();
    next();
  } catch (error) {
    next(error);
  }
}

router.get('/map', ensureBuiltMiddleware, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

router.get('/map/', ensureBuiltMiddleware, (req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

router.use('/map', ensureBuiltMiddleware, express.static(distDir, { extensions: ['html'] }));

module.exports = router;
