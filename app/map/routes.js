// -----------------------------------------------------------------------------
// /map — live documentation site (Express + Nunjucks)
// -----------------------------------------------------------------------------
// Renders the ported map-site-template markup live from the map.json manifests +
// insights.md / implementation.md. No build step: edit those files and refresh.
//
// URL structure:
//   GET /map                                  -> overview (journeys by section)
//   GET /map/:version/:journey                -> journey board
//   GET /map/:version/:journey/:step          -> step detail
//   GET /map/:version/:journey/:step/:variant -> step detail (variant via map.js)
//
// Static:
//   /map-assets       -> app/map/assets       (map.css/js, site.css/js)
//   /map-screenshots  -> app/map/screenshots  (captured PNGs)
//
// Mounted from app/routes.js at '/', OUTSIDE the version middleware (its own URLs
// are not version-prefixed).
// -----------------------------------------------------------------------------

const path = require('node:path');
const express = require('express');
const nunjucks = require('nunjucks');

const model = require('./lib/journey-model');

const router = express.Router();

// Dedicated Nunjucks env: map templates + nhsuk-frontend macros.
const templatesDir = path.join(__dirname, 'templates');
const nhsukDist = path.join(path.dirname(require.resolve('nhsuk-frontend/package.json')), 'dist');
const env = nunjucks.configure([templatesDir, nhsukDist, path.join(nhsukDist, 'nhsuk')], {
  autoescape: true,
  noCache: process.env.NODE_ENV !== 'production',
});

const ASSET_ROOT = '/map-assets';

// Static assets + captured screenshots.
router.use('/map-assets', express.static(path.join(__dirname, 'assets')));
router.use('/map-screenshots', express.static(path.join(__dirname, 'screenshots')));

function render(res, template, context) {
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(env.render(template, { assetRoot: ASSET_ROOT, bodyClass: '', ...context }));
}

// Overview
router.get('/map', (req, res) => {
  const { sections } = model.buildOverviewModel();
  render(res, 'pages/overview.njk', {
    pageTitle: 'User journeys',
    description: 'Documentation map of the prototype journeys.',
    sections,
    breadcrumbParams: null,
  });
});

// Journey board
router.get('/map/:version/:journey', (req, res, next) => {
  const journey = model.buildJourneyModel(req.params.version, req.params.journey);
  if (!journey) return next();
  render(res, 'pages/journey.njk', {
    pageTitle: journey.title,
    description: `${journey.title} journey map`,
    journey,
    pageConfigJson: JSON.stringify({ initialView: 'board', mermaidSource: '', mapStyle: 'default' }),
    breadcrumbParams: { items: [{ href: '/map', text: 'Journeys' }] },
  });
});

function renderStep(req, res, next) {
  const result = model.buildStepModel(req.params.version, req.params.journey, req.params.step);
  if (!result) return next();
  render(res, 'pages/step.njk', {
    pageTitle: result.step.title,
    description: `${result.journey.title}: ${result.step.title}`,
    journey: result.journey,
    step: result.step,
    breadcrumbParams: {
      items: [
        { href: '/map', text: 'Journeys' },
        { href: model.journeyPath(req.params.version, req.params.journey), text: result.journey.title },
      ],
    },
  });
}

// Step detail (and the variant sub-path; map.js reads :variant from the URL).
router.get('/map/:version/:journey/:step', renderStep);
router.get('/map/:version/:journey/:step/:variant', renderStep);

module.exports = router;
