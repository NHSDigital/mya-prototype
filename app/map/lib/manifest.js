// -----------------------------------------------------------------------------
// map.json manifest loader (shared)
// -----------------------------------------------------------------------------
// Discovers and parses every app/journeys/<version>/<journey>/map.json. The
// journey id and version are INFERRED from the folder path, so the JSON stays
// light and cannot drift from its location.
//
// Used by: the live /map site (app/map/routes.js), the screenshot capture
// script, and the validator. Returns a lenient, normalized model plus warnings;
// it does not throw on bad data (callers decide how strict to be).
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..', '..'); // repo root
const journeysRoot = path.join(root, 'app', 'journeys');

function normalizePath(routePath) {
  if (!routePath || routePath === '/') return routePath || '';
  return String(routePath).replace(/\/+$/, '');
}

function hasRouteParams(routePath) {
  return /(^|\/):[A-Za-z0-9_]+/.test(String(routePath || ''));
}

function isConcreteAbsolutePath(p) {
  const v = String(p || '').trim();
  return v.startsWith('/') && !hasRouteParams(v) && !v.split('/').includes('..');
}

function sanitizeForFileName(value) {
  return (
    String(value)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

// Find every map.json under app/journeys/<version>/<journey>/map.json
function listManifestFiles() {
  const files = [];
  if (!fs.existsSync(journeysRoot)) return files;

  for (const versionEntry of fs.readdirSync(journeysRoot, { withFileTypes: true })) {
    if (!versionEntry.isDirectory()) continue;
    if (versionEntry.name.startsWith('_')) continue; // skip _shared, _legacy, etc.
    const versionDir = path.join(journeysRoot, versionEntry.name);

    for (const journeyEntry of fs.readdirSync(versionDir, { withFileTypes: true })) {
      if (!journeyEntry.isDirectory()) continue;
      if (journeyEntry.name.startsWith('_')) continue;
      const manifestPath = path.join(versionDir, journeyEntry.name, 'map.json');
      if (fs.existsSync(manifestPath)) {
        files.push({
          manifestPath,
          version: versionEntry.name,
          journey: journeyEntry.name,
          dir: path.join(versionDir, journeyEntry.name),
        });
      }
    }
  }

  files.sort((a, b) => a.manifestPath.localeCompare(b.manifestPath));
  return files;
}

function normalizeScreenshots(rawVariant, ctx, warnings) {
  const out = [];
  const list = Array.isArray(rawVariant.screenshots) ? rawVariant.screenshots : [];
  list.forEach((entry, index) => {
    if (!isPlainObject(entry)) {
      warnings.push(`${ctx} screenshots[${index}] must be an object`);
      return;
    }
    const p = normalizePath(entry.path);
    if (!isConcreteAbsolutePath(p)) {
      warnings.push(`${ctx} screenshots[${index}].path '${entry.path}' must be a concrete absolute path (no :params)`);
      return;
    }
    if (entry.data !== undefined && !isPlainObject(entry.data)) {
      warnings.push(`${ctx} screenshots[${index}].data must be an object`);
      return;
    }
    out.push({
      path: p,
      label: typeof entry.label === 'string' ? entry.label.trim() : '',
      data: isPlainObject(entry.data) ? entry.data : {},
    });
  });
  return out;
}

function normalizeVariant(rawVariant, stepId, warnings) {
  if (!isPlainObject(rawVariant)) {
    warnings.push(`step '${stepId}' has a non-object variant`);
    return null;
  }
  const id = String(rawVariant.id || '').trim();
  const label = String(rawVariant.label || '').trim();
  if (!id || !label) {
    warnings.push(`step '${stepId}' variant missing id/label`);
    return null;
  }
  const screenshots = normalizeScreenshots(rawVariant, `step '${stepId}' variant '${id}'`, warnings);
  if (!screenshots.length) {
    warnings.push(`step '${stepId}' variant '${id}' has no valid screenshots`);
    return null;
  }
  return {
    id,
    label,
    description: typeof rawVariant.description === 'string' ? rawVariant.description.trim() : '',
    alt: typeof rawVariant.alt === 'string' ? rawVariant.alt.trim() : '',
    caption: typeof rawVariant.caption === 'string' ? rawVariant.caption.trim() : '',
    screenshots,
  };
}

function normalizeStep(rawStep, warnings) {
  if (!isPlainObject(rawStep)) {
    warnings.push('a step is not an object');
    return null;
  }
  const id = String(rawStep.id || '').trim();
  const title = String(rawStep.title || '').trim();
  if (!id || !title) {
    warnings.push(`a step is missing id/title (id='${id}')`);
    return null;
  }
  const variants = [];
  const seen = new Set();
  for (const rawVariant of Array.isArray(rawStep.variants) ? rawStep.variants : []) {
    const variant = normalizeVariant(rawVariant, id, warnings);
    if (!variant) continue;
    if (seen.has(variant.id)) {
      warnings.push(`step '${id}' has duplicate variant id '${variant.id}'`);
      continue;
    }
    seen.add(variant.id);
    variants.push(variant);
  }
  if (!variants.length) {
    warnings.push(`step '${id}' has no valid variants`);
    return null;
  }
  const requestedDefault = String(rawStep.defaultVariant || '').trim() || 'default';
  const defaultVariantId = variants.some((v) => v.id === requestedDefault) ? requestedDefault : variants[0].id;
  return {
    id,
    title,
    summary: typeof rawStep.summary === 'string' ? rawStep.summary.trim() : '',
    status: typeof rawStep.status === 'string' ? rawStep.status.trim() : '',
    defaultVariantId,
    variants,
  };
}

function loadManifest(file, warnings) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(file.manifestPath, 'utf8'));
  } catch (error) {
    warnings.push(`${path.relative(root, file.manifestPath)}: JSON parse error: ${error.message}`);
    return null;
  }
  if (!isPlainObject(doc)) {
    warnings.push(`${path.relative(root, file.manifestPath)}: top level must be an object`);
    return null;
  }

  const steps = [];
  const seen = new Set();
  for (const rawStep of Array.isArray(doc.steps) ? doc.steps : []) {
    const step = normalizeStep(rawStep, warnings);
    if (!step) continue;
    if (seen.has(step.id)) {
      warnings.push(`${file.journey}/${file.version}: duplicate step id '${step.id}'`);
      continue;
    }
    seen.add(step.id);
    steps.push(step);
  }
  if (!steps.length) {
    warnings.push(`${path.relative(root, file.manifestPath)}: no valid steps`);
    return null;
  }

  return {
    journey: file.journey,
    version: file.version,
    dir: file.dir,
    manifestPath: file.manifestPath,
    title: typeof doc.title === 'string' && doc.title.trim() ? doc.title.trim() : file.journey,
    summary: typeof doc.summary === 'string' ? doc.summary.trim() : '',
    section: typeof doc.section === 'string' && doc.section.trim() ? doc.section.trim() : 'Journeys',
    status: typeof doc.status === 'string' ? doc.status.trim() : '',
    steps,
  };
}

function loadManifests({ journeyFilter, versionFilter } = {}) {
  const warnings = [];
  const models = [];
  for (const file of listManifestFiles()) {
    if (journeyFilter && file.journey !== journeyFilter) continue;
    if (versionFilter && file.version !== versionFilter) continue;
    const model = loadManifest(file, warnings);
    if (model) models.push(model);
  }
  return { models, warnings };
}

module.exports = {
  root,
  journeysRoot,
  loadManifests,
  listManifestFiles,
  normalizePath,
  hasRouteParams,
  isConcreteAbsolutePath,
  sanitizeForFileName,
};
