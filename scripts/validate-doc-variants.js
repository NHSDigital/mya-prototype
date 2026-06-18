#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');
const {
  listClinicEditSuccessDocVariantIds
} = require('../app/data/doc-variants/clinic-edit-success');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_MANIFEST = 'docs/doc-variants/change-clinic-series-success.json';

function parseArgs(argv) {
  const options = {
    manifest: DEFAULT_MANIFEST,
    stepYaml: '',
    version: '',
    requireScreenshots: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === '--manifest') {
      options.manifest = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--step-yaml') {
      options.stepYaml = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--version') {
      options.version = argv[index + 1] || '';
      index += 1;
      continue;
    }

    if (arg === '--require-screenshots') {
      options.requireScreenshots = true;
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
  console.log('Validate documentation variant manifest coverage.');
  console.log('');
  console.log('Usage:');
  console.log('  node scripts/validate-doc-variants.js [options]');
  console.log('');
  console.log('Options:');
  console.log(`  --manifest <path>         Manifest path (default: ${DEFAULT_MANIFEST})`);
  console.log('  --step-yaml <path>        Optional step.yaml path for map coverage checks');
  console.log('  --version <id>            Step version id for coverage checks (for example v2)');
  console.log('  --require-screenshots     Require screenshot files to already exist');
}

function readJson(filePath) {
  const absolutePath = path.resolve(REPO_ROOT, filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  return {
    absolutePath,
    value: JSON.parse(fs.readFileSync(absolutePath, 'utf8'))
  };
}

function readYaml(filePath) {
  const absolutePath = path.resolve(REPO_ROOT, filePath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  return {
    absolutePath,
    value: yaml.load(fs.readFileSync(absolutePath, 'utf8'))
  };
}

function ensureString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function validateManifestEntries(entries, options) {
  const errors = [];
  const seenIds = new Set();
  const seenScreenshots = new Set();
  const validDocVariantIds = new Set(listClinicEditSuccessDocVariantIds());

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== 'object') {
      errors.push(`entries[${index}] must be an object.`);
      return;
    }

    const id = ensureString(entry.id);
    const docVariant = ensureString(entry.docVariant);
    const urlPath = ensureString(entry.urlPath);
    const screenshot = ensureString(entry.screenshot);

    if (!id) {
      errors.push(`entries[${index}].id is required.`);
    } else if (seenIds.has(id)) {
      errors.push(`Duplicate entry id: ${id}`);
    } else {
      seenIds.add(id);
    }

    if (!docVariant) {
      errors.push(`entries[${index}].docVariant is required.`);
    } else if (!validDocVariantIds.has(docVariant)) {
      errors.push(`entries[${index}].docVariant is unknown: ${docVariant}`);
    }

    if (!urlPath) {
      errors.push(`entries[${index}].urlPath is required.`);
    }

    if (!screenshot) {
      errors.push(`entries[${index}].screenshot is required.`);
    } else if (seenScreenshots.has(screenshot)) {
      errors.push(`Duplicate screenshot path: ${screenshot}`);
    } else {
      seenScreenshots.add(screenshot);
    }

    if (options.requireScreenshots && screenshot) {
      const screenshotAbsolutePath = path.resolve(REPO_ROOT, screenshot);
      if (!fs.existsSync(screenshotAbsolutePath)) {
        errors.push(`Screenshot file does not exist: ${screenshot}`);
      }
    }
  });

  return errors;
}

function resolveStepVersion(stepConfig, requestedVersion, contextPath) {
  const versions = stepConfig?.versions || {};
  let versionId = ensureString(requestedVersion);
  const visited = new Set();

  if (!versionId) {
    throw new Error(`A version id is required for ${contextPath}`);
  }

  while (true) {
    if (visited.has(versionId)) {
      throw new Error(`Circular version alias detected for ${contextPath}: ${Array.from(visited).join(' -> ')} -> ${versionId}`);
    }

    visited.add(versionId);

    const config = versions[versionId];
    if (!config || typeof config !== 'object') {
      throw new Error(`Missing versions.${versionId} in ${contextPath}`);
    }

    const aliasTarget = ensureString(config.use);
    if (!aliasTarget) {
      return {
        versionId,
        config
      };
    }

    versionId = aliasTarget;
  }
}

function validateStepCoverage({ manifestEntries, stepYamlPath, versionId }) {
  const errors = [];

  const { absolutePath, value } = readYaml(stepYamlPath);
  const resolvedVersion = resolveStepVersion(value || {}, versionId, absolutePath);
  const stepVariants = Array.isArray(resolvedVersion.config?.variants)
    ? resolvedVersion.config.variants
    : [];

  const stepVariantIds = stepVariants
    .map((variant) => ensureString(variant?.id))
    .filter(Boolean);
  const mappedVariantIds = manifestEntries
    .map((entry) => ensureString(entry?.mapVariantId))
    .filter(Boolean);
  const mappedVariantIdSet = new Set(mappedVariantIds);

  for (const stepVariantId of stepVariantIds) {
    if (!mappedVariantIdSet.has(stepVariantId)) {
      errors.push(`Step variant ${stepVariantId} is missing a manifest mapVariantId.`);
    }
  }

  for (const mappedVariantId of mappedVariantIds) {
    if (!stepVariantIds.includes(mappedVariantId)) {
      errors.push(`Manifest references unknown step variant id: ${mappedVariantId}`);
    }
  }

  return {
    errors,
    resolvedVersionId: resolvedVersion.versionId,
    stepVariantCount: stepVariantIds.length
  };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const { absolutePath, value } = readJson(options.manifest);

  const entries = Array.isArray(value?.entries) ? value.entries : [];
  if (entries.length === 0) {
    throw new Error(`Manifest has no entries: ${absolutePath}`);
  }

  const errors = validateManifestEntries(entries, options);

  let coverageSummary = null;
  const configuredStepYaml = options.stepYaml || ensureString(value?.step?.stepYaml);
  const configuredVersion = options.version || ensureString(value?.step?.version);

  if (configuredStepYaml || configuredVersion) {
    if (!configuredStepYaml || !configuredVersion) {
      throw new Error('Both --step-yaml and --version are required for step coverage checks.');
    }

    coverageSummary = validateStepCoverage({
      manifestEntries: entries,
      stepYamlPath: configuredStepYaml,
      versionId: configuredVersion
    });
    errors.push(...coverageSummary.errors);
  }

  if (errors.length > 0) {
    console.error('Validation failed:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log(`Manifest validated: ${absolutePath}`);
  console.log(`Entries: ${entries.length}`);
  if (coverageSummary) {
    console.log(`Step coverage: ${coverageSummary.stepVariantCount} variants (resolved version ${coverageSummary.resolvedVersionId})`);
  }
  if (options.requireScreenshots) {
    console.log('Screenshot file existence check: enabled');
  }
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
