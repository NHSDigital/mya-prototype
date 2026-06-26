#!/usr/bin/env node
// -----------------------------------------------------------------------------
// journey:new — scaffold a new journey folder (the deterministic backbone)
// -----------------------------------------------------------------------------
// Creates app/journeys/<version>/<name>/ with a commented routes.js, a starter
// view, a map.json skeleton, and insights.md / implementation.md stubs, then
// inserts the mount line into app/journeys/<version>/index.js.
//
// An LLM (or a human) then fills in the real views/routes using the approved
// components documented in AGENTS.md, and the map.json variants/hydration.
//
// Usage: node scripts/journey-new.js --name "book-a-clinic" [--version v1]
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { version: 'v1' };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--name') args.name = argv[i + 1];
    if (argv[i] === '--version') args.version = argv[i + 1];
  }
  return args;
}

function fail(message) {
  console.error(`[journey:new] ${message}`);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!args.name) fail('missing --name (e.g. --name "book-a-clinic")');
const name = String(args.name).trim();
if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) fail(`--name '${name}' must be kebab-case (lowercase, hyphens)`);
if (!/^v[0-9]+$/.test(args.version)) fail(`--version '${args.version}' must look like v1, v2, ...`);

const versionDir = path.join(root, 'app', 'journeys', args.version);
if (!fs.existsSync(versionDir)) fail(`version folder ${path.relative(root, versionDir)} does not exist`);
const journeyDir = path.join(versionDir, name);
if (fs.existsSync(journeyDir)) fail(`journey folder ${path.relative(root, journeyDir)} already exists`);

fs.mkdirSync(journeyDir, { recursive: true });

const titleCase = name.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// --- routes.js ---------------------------------------------------------------
fs.writeFileSync(
  path.join(journeyDir, 'routes.js'),
  `// Journey: ${titleCase}
// URL base: /site/:id/${name}
// Per-site context (req.site_id, res.locals.*) is provided centrally by
// app/journeys/_shared/site-context.js. Keep GET handlers IDEMPOTENT: render
// everything from req.session.data so the page can be screenshotted from a
// map.json variant alone. Render with version-agnostic names ('${name}/...').

const express = require('express');
const router = express.Router();

// Start page. Replace/extend with the real steps for this journey.
router.get('/site/:id/${name}', (req, res) => {
  res.render('${name}/start', {
    pageName: '${titleCase}',
  });
});

module.exports = router;
`
);

// --- starter view ------------------------------------------------------------
fs.writeFileSync(
  path.join(journeyDir, 'start.html'),
  `{% extends 'layout.html' %}

{% block content %}
  <div class="nhsuk-grid-row">
    <div class="nhsuk-grid-column-two-thirds">
      <h1 class="nhsuk-heading-l">{{ pageName }}</h1>
      <p class="nhsuk-body">Scaffolded by journey:new. Replace this with the real first step,
        using the approved components documented in AGENTS.md.</p>
    </div>
  </div>
{% endblock %}
`
);

// --- map.json ----------------------------------------------------------------
fs.writeFileSync(
  path.join(journeyDir, 'map.json'),
  `${JSON.stringify(
    {
      $schema: '../../../map/map.schema.json',
      title: titleCase,
      summary: `TODO: one-line description of the ${titleCase} journey.`,
      section: 'Journeys',
      status: 'in progress',
      steps: [
        {
          id: 'start',
          title: 'Start',
          summary: 'TODO: what happens on this step.',
          defaultVariant: 'default',
          variants: [
            {
              id: 'default',
              label: 'Default',
              screenshots: [
                { label: 'Default', path: `/${args.version}/site/1/${name}`, data: {} },
              ],
            },
          ],
        },
      ],
    },
    null,
    2
  )}\n`
);

// --- insights.md / implementation.md ----------------------------------------
fs.writeFileSync(
  path.join(journeyDir, 'insights.md'),
  `## Why this journey exists

TODO: a short write-up of the problem this journey solves and the key decisions made.

## What to try next

- TODO
`
);
fs.writeFileSync(
  path.join(journeyDir, 'implementation.md'),
  `## User story

**As a** TODO
**I want to** TODO
**So that** TODO.

## Acceptance criteria

- **Given** TODO
  **When** TODO
  **Then** TODO.
`
);

// --- insert the mount line into the version index ----------------------------
const indexPath = path.join(versionDir, 'index.js');
let mounted = false;
if (fs.existsSync(indexPath)) {
  const source = fs.readFileSync(indexPath, 'utf8');
  const mountLine = `router.use('/', require('./${name}/routes'));`;
  if (source.includes(mountLine)) {
    mounted = true;
  } else {
    const marker = '// Legacy redirects';
    let updated;
    if (source.includes(marker)) {
      updated = source.replace(marker, `${mountLine}\n\n${marker}`);
    } else {
      updated = source.replace('module.exports = router;', `${mountLine}\n\nmodule.exports = router;`);
    }
    if (updated !== source) {
      fs.writeFileSync(indexPath, updated);
      mounted = true;
    }
  }
}

console.log(`[journey:new] created ${path.relative(root, journeyDir)}/`);
console.log('  routes.js  start.html  map.json  insights.md  implementation.md');
console.log(
  mounted
    ? `[journey:new] mounted in ${path.relative(root, indexPath)}`
    : `[journey:new] could not auto-mount; add manually to ${path.relative(root, indexPath)}:\n    router.use('/', require('./${name}/routes'));`
);
console.log('\nNext steps:');
console.log(`  1. Build the real steps in app/journeys/${args.version}/${name}/ using approved components (see AGENTS.md).`);
console.log(`  2. Fill in map.json variants + hydration data, insights.md and implementation.md.`);
console.log(`  3. npm start, then npm run map:validate and npm run map:screenshots -- --journey ${name}`);
console.log(`  4. View it at /map/${args.version}/${name}`);
