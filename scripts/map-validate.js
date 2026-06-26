#!/usr/bin/env node
// -----------------------------------------------------------------------------
// map:validate — check map.json manifests are valid and in sync with the routes
// -----------------------------------------------------------------------------
// Two-way, right-sized consistency check (this is "drift", folded in here):
//
//   HARD FAIL:
//     - map.json that fails to parse / has no valid steps (loader warnings)
//     - a screenshots[].path that does not resolve to a mounted route
//       (checked against the running prototype if reachable)
//
//   WARNING (non-blocking):
//     - a journey folder that has routes.js but no map.json (uncovered journey)
//     - missing screenshot PNGs (run map:screenshots)
//
// If the prototype is not running, the route-resolution check is skipped with a
// notice (schema checks still run). Usage:
//   node scripts/map-validate.js [--base-url http://localhost:2000] [--strict]
// `--strict` turns warnings into failures.
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const { loadManifests, journeysRoot, root, sanitizeForFileName } = require('../app/map/lib/manifest');

function parseArgs(argv) {
  const args = { baseUrl: process.env.MAP_BASE_URL || 'http://localhost:2000', strict: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--base-url') args.baseUrl = argv[i + 1];
    if (argv[i] === '--strict') args.strict = true;
  }
  return args;
}

async function isReachable(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch(baseUrl, { signal: controller.signal });
    return res.ok || res.status >= 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function routeResolves(baseUrl, routePath) {
  try {
    const res = await fetch(new URL(routePath, baseUrl).toString(), { redirect: 'manual' });
    // 2xx = ok, 3xx = redirect (acceptable), 404/5xx = broken
    return res.status < 400;
  } catch {
    return false;
  }
}

// Journey folders that have routes.js but no map.json (uncovered).
function findUncoveredJourneys() {
  const uncovered = [];
  if (!fs.existsSync(journeysRoot)) return uncovered;
  for (const v of fs.readdirSync(journeysRoot, { withFileTypes: true })) {
    if (!v.isDirectory() || v.name.startsWith('_')) continue;
    const versionDir = path.join(journeysRoot, v.name);
    for (const j of fs.readdirSync(versionDir, { withFileTypes: true })) {
      if (!j.isDirectory() || j.name.startsWith('_')) continue;
      const dir = path.join(versionDir, j.name);
      if (fs.existsSync(path.join(dir, 'routes.js')) && !fs.existsSync(path.join(dir, 'map.json'))) {
        uncovered.push(`${v.name}/${j.name}`);
      }
    }
  }
  return uncovered;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const errors = [];
  const warnings = [];

  const { models, warnings: loaderWarnings } = loadManifests();
  for (const w of loaderWarnings) errors.push(`manifest: ${w}`);

  // Coverage warning
  for (const j of findUncoveredJourneys()) warnings.push(`journey '${j}' has routes.js but no map.json`);

  // Screenshot PNG presence (warning) + route resolution (hard fail if server up)
  const serverUp = await isReachable(args.baseUrl);
  if (!serverUp) {
    warnings.push(`prototype not reachable at ${args.baseUrl} — route-resolution check skipped (start it with npm start)`);
  }

  for (const model of models) {
    for (const step of model.steps) {
      for (const variant of step.variants) {
        // PNG presence (primary screenshot uses variant.id)
        const png = path.join(
          root,
          'app',
          'map',
          'screenshots',
          model.journey,
          model.version,
          step.id,
          `${sanitizeForFileName(variant.id)}.png`
        );
        if (!fs.existsSync(png)) {
          warnings.push(`missing screenshot ${path.relative(root, png)} (run npm run map:screenshots)`);
        }
        // Route resolution
        if (serverUp) {
          for (const shot of variant.screenshots) {
            // eslint-disable-next-line no-await-in-loop
            const ok = await routeResolves(args.baseUrl, shot.path);
            if (!ok) {
              errors.push(
                `${model.version}/${model.journey} step '${step.id}' variant '${variant.id}': path '${shot.path}' does not resolve to a route`
              );
            }
          }
        }
      }
    }
  }

  // Report
  console.log(`[map:validate] ${models.length} manifest(s) checked`);
  for (const w of warnings) console.warn(`  warning: ${w}`);
  for (const e of errors) console.error(`  ERROR: ${e}`);

  const failed = errors.length > 0 || (args.strict && warnings.length > 0);
  if (failed) {
    console.error(`[map:validate] FAILED (${errors.length} error(s)${args.strict ? `, ${warnings.length} warning(s) [strict]` : ''})`);
    process.exit(1);
  }
  console.log(`[map:validate] OK${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
}

main().catch((error) => {
  console.error(`[map:validate] fatal: ${error.message}`);
  process.exit(1);
});
