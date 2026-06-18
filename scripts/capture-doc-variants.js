#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST = 'docs/doc-variants/change-clinic-series-success.json';
const DEFAULT_BASE_URL = process.env.DOC_CAPTURE_BASE_URL || 'http://localhost:2001';

function parseArgs(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    baseUrl: DEFAULT_BASE_URL,
    ids: new Set(),
    dryRun: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--manifest') {
      options.manifest = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--base-url') {
      options.baseUrl = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--id') {
      const id = String(argv[index + 1] || '').trim();
      if (id) {
        options.ids.add(id);
      }
      index += 1;
      continue;
    }

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function printHelp() {
  console.log('Capture documentation variants to screenshots.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/capture-doc-variants.js [options]');
  console.log('');
  console.log('Options:');
  console.log(`  --manifest <path>   Manifest path (default: ${DEFAULT_MANIFEST})`);
  console.log(`  --base-url <url>    Prototype base URL (default: ${DEFAULT_BASE_URL})`);
  console.log('  --id <variant-id>   Capture only one variant id (repeatable)');
  console.log('  --dry-run           Print capture plan without writing screenshots');
}

function readManifest(manifestPath) {
  const absolutePath = path.resolve(REPO_ROOT, manifestPath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Manifest not found: ${absolutePath}`);
  }

  const manifest = JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
  if (!Array.isArray(manifest.entries) || manifest.entries.length === 0) {
    throw new Error(`Manifest must include a non-empty entries list: ${absolutePath}`);
  }

  return { manifest, absolutePath };
}

function ensurePlaywrightAvailable() {
  const versionCheck = spawnSync('npx', ['--yes', 'playwright', '--version'], {
    stdio: 'pipe',
    encoding: 'utf8'
  });

  if (versionCheck.status === 0) {
    return;
  }

  throw new Error(
    [
      'Unable to run Playwright from npx.',
      'Install Playwright first, for example:',
      '  npm install --save-dev playwright',
      'Then install the browser:',
      '  npx playwright install chromium'
    ].join('\n')
  );
}

function resolveCaptureEntries(entries, selectedIds) {
  if (!selectedIds || selectedIds.size === 0) {
    return entries;
  }

  return entries.filter((entry) => selectedIds.has(String(entry.id || '').trim()));
}

function runCapture({ baseUrl, entries, dryRun }) {
  const failures = [];

  for (const entry of entries) {
    const id = String(entry.id || '').trim();
    const urlPath = String(entry.urlPath || '').trim();
    const screenshotPath = String(entry.screenshot || '').trim();

    if (!id || !urlPath || !screenshotPath) {
      failures.push({
        id: id || '(missing-id)',
        reason: 'Each entry must include id, urlPath, and screenshot.'
      });
      continue;
    }

    let captureUrl = '';
    try {
      captureUrl = new URL(urlPath, baseUrl).toString();
    } catch (error) {
      failures.push({
        id,
        reason: `Invalid URL for entry: ${urlPath}`
      });
      continue;
    }

    const screenshotAbsolutePath = path.resolve(REPO_ROOT, screenshotPath);
    fs.mkdirSync(path.dirname(screenshotAbsolutePath), { recursive: true });

    console.log(`- ${id}`);
    console.log(`  URL: ${captureUrl}`);
    console.log(`  File: ${screenshotAbsolutePath}`);

    if (dryRun) {
      continue;
    }

    const screenshotCommand = [
      '--yes',
      'playwright',
      'screenshot',
      '--browser=chromium',
      '--wait-for-timeout=1000',
      '--full-page',
      captureUrl,
      screenshotAbsolutePath
    ];

    const runResult = spawnSync('npx', screenshotCommand, {
      stdio: 'inherit'
    });

    if (runResult.status !== 0) {
      failures.push({
        id,
        reason: `Playwright screenshot failed with exit code ${runResult.status}`
      });
    }
  }

  return failures;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { manifest, absolutePath } = readManifest(options.manifest);
  const selectedEntries = resolveCaptureEntries(manifest.entries, options.ids);

  if (selectedEntries.length === 0) {
    throw new Error('No entries matched the requested ids.');
  }

  console.log(`Using manifest: ${absolutePath}`);
  console.log(`Base URL: ${options.baseUrl}`);
  console.log(`Entries to capture: ${selectedEntries.length}`);

  if (!options.dryRun) {
    ensurePlaywrightAvailable();
  }

  const failures = runCapture({
    baseUrl: options.baseUrl,
    entries: selectedEntries,
    dryRun: options.dryRun
  });

  if (failures.length > 0) {
    console.error('');
    console.error('Capture finished with failures:');
    for (const failure of failures) {
      console.error(`- ${failure.id}: ${failure.reason}`);
    }
    process.exit(1);
  }

  console.log('');
  console.log(options.dryRun ? 'Dry run completed successfully.' : 'Capture completed successfully.');
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
