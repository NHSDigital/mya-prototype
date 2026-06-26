#!/usr/bin/env node
// -----------------------------------------------------------------------------
// map:screenshots — capture a PNG for every variant in every map.json
// -----------------------------------------------------------------------------
// For each variant screenshot in the manifests it:
//   1. encodes the screenshot `data` as the x-journey-screenshot-data header
//      (base64url), which app/middleware/screenshot-data.js merges into the
//      session before the page renders (so the variant renders deterministically);
//   2. loads the concrete route in headless Chromium (1440x2000, full page);
//   3. writes app/map/screenshots/<journey>/<version>/<step>/<fileId>.png.
//
// The prototype must be running (npm start). Usage:
//   node scripts/map-screenshots.js [--journey x] [--version v1] [--step s]
//        [--variant v] [--base-url http://localhost:2000] [--dry-run]
//
// Ported from nhs-ai-enhanced-prototype/scripts/capture-journey-screenshots.js.
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const { loadManifests, sanitizeForFileName, root } = require('../app/map/lib/manifest');

const screenshotRoot = path.join(root, 'app', 'map', 'screenshots');
const reportPath = path.join(screenshotRoot, 'report.json');

function parseArgs(argv) {
  const args = { baseUrl: process.env.MAP_BASE_URL || 'http://localhost:2000', dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i];
    if (t === '--journey') args.journey = argv[i + 1];
    if (t === '--version') args.version = argv[i + 1];
    if (t === '--step') args.step = argv[i + 1];
    if (t === '--variant') args.variant = argv[i + 1];
    if (t === '--base-url') args.baseUrl = argv[i + 1];
    if (t === '--dry-run') args.dryRun = true;
  }
  return args;
}

// One capture task per screenshot entry. Primary screenshot (index 0) is named
// <variant.id>.png (that is what the /map UI references); extra states get a
// <variant.id>--<label-slug>.png suffix.
function createCapturePlan(models, baseUrl, filters = {}) {
  const tasks = [];
  for (const model of models) {
    if (filters.journey && model.journey !== filters.journey) continue;
    if (filters.version && model.version !== filters.version) continue;
    for (const step of model.steps) {
      if (filters.step && step.id !== filters.step) continue;
      for (const variant of step.variants) {
        if (filters.variant && variant.id !== filters.variant) continue;
        const multi = variant.screenshots.length > 1;
        variant.screenshots.forEach((shot, index) => {
          const labelSlug = shot.label ? sanitizeForFileName(shot.label) : `shot-${index + 1}`;
          const fileId = multi ? (index === 0 ? variant.id : `${variant.id}--${labelSlug}`) : variant.id;
          tasks.push({
            journey: model.journey,
            version: model.version,
            step: step.id,
            variantId: variant.id,
            fileId: sanitizeForFileName(fileId),
            capturePath: shot.path,
            data: shot.data || {},
            url: new URL(shot.path, baseUrl).toString(),
            outputPath: path.join(
              screenshotRoot,
              model.journey,
              model.version,
              step.id,
              `${sanitizeForFileName(fileId)}.png`
            ),
          });
        });
      }
    }
  }
  return tasks;
}

async function isServerReachable(baseUrl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(baseUrl, { method: 'GET', signal: controller.signal });
    return res.ok || res.status >= 300;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForVisualReadiness(page, settleMs = 900) {
  await page.waitForLoadState('domcontentloaded', { timeout: 30000 });
  await page.waitForLoadState('load', { timeout: 30000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 });
  await page.evaluate(async () => {
    const links = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));
    await Promise.all(
      links.map(
        (link) =>
          new Promise((resolve) => {
            if (link.sheet) return resolve();
            link.addEventListener('load', resolve, { once: true });
            link.addEventListener('error', resolve, { once: true });
          })
      )
    );
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {}
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(settleMs);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { models, warnings } = loadManifests({ journeyFilter: args.journey, versionFilter: args.version });
  for (const w of warnings) console.warn(`[screenshots] manifest warning: ${w}`);

  const tasks = createCapturePlan(models, args.baseUrl, args);
  if (!tasks.length) {
    console.log('[screenshots] no variants to capture');
    process.exit(0);
  }
  fs.mkdirSync(screenshotRoot, { recursive: true });

  if (args.dryRun) {
    const report = {
      generatedAt: new Date().toISOString(),
      mode: 'dry-run',
      baseUrl: args.baseUrl,
      taskCount: tasks.length,
      tasks: tasks.map((t) => ({ ...t, outputPath: path.relative(root, t.outputPath) })),
    };
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`[screenshots] dry-run planned ${tasks.length} screenshot(s) -> ${path.relative(root, reportPath)}`);
    for (const t of tasks) console.log(`  ${t.journey}/${t.version}/${t.step}/${t.fileId} <- ${t.capturePath}`);
    process.exit(0);
  }

  if (!(await isServerReachable(args.baseUrl))) {
    console.error(`[screenshots] cannot reach ${args.baseUrl}. Start the prototype (npm start) or pass --base-url.`);
    process.exit(1);
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('[screenshots] missing dependency: playwright. Run: npm install && npx playwright install chromium');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 2000 } });
  const results = [];
  try {
    for (const task of tasks) {
      const page = await context.newPage();
      try {
        if (Object.keys(task.data).length) {
          const encoded = Buffer.from(JSON.stringify(task.data), 'utf8').toString('base64url');
          await page.setExtraHTTPHeaders({ 'x-journey-screenshot-data': encoded });
        }
        await page.goto(task.url, { waitUntil: 'networkidle', timeout: 30000 });
        await waitForVisualReadiness(page);
        fs.mkdirSync(path.dirname(task.outputPath), { recursive: true });
        await page.screenshot({ path: task.outputPath, fullPage: true });
        results.push({ ...task, outputPath: path.relative(root, task.outputPath), status: 'captured' });
        console.log(`[screenshots] captured ${path.relative(root, task.outputPath)}`);
      } catch (error) {
        results.push({ ...task, outputPath: path.relative(root, task.outputPath), status: 'failed', error: error.message });
        console.error(`[screenshots] failed ${task.capturePath}: ${error.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }

  const failedCount = results.filter((r) => r.status === 'failed').length;
  fs.writeFileSync(
    reportPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: 'capture',
        baseUrl: args.baseUrl,
        taskCount: tasks.length,
        capturedCount: tasks.length - failedCount,
        failedCount,
        results,
      },
      null,
      2
    )}\n`
  );
  console.log(`[screenshots] ${tasks.length - failedCount}/${tasks.length} captured -> ${path.relative(root, reportPath)}`);
  if (failedCount > 0) process.exit(1);
}

main().catch((error) => {
  console.error(`[screenshots] fatal: ${error.message}`);
  process.exit(1);
});
