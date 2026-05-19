const fs = require('node:fs');
const path = require('node:path');

let yaml;
try {
  yaml = require('js-yaml');
} catch (error) {
  throw new Error(
    'The /map folder requires the "js-yaml" package. Install it in the prototype with `npm install js-yaml`.'
  );
}

let nunjucks;
try {
  nunjucks = require('nunjucks');
} catch (error) {
  throw new Error(
    'The /map folder requires the "nunjucks" package. Install it in the prototype with `npm install nunjucks`.'
  );
}

const MAP_DIR = __dirname;
const DIST_DIR = path.join(MAP_DIR, 'dist');
const JOURNEYS_DIR = path.join(MAP_DIR, 'journeys');
const ASSETS_DIR = path.join(MAP_DIR, 'assets');
const TEMPLATES_DIR = path.join(MAP_DIR, 'templates');
const VERSIONS_META_PATH = path.join(MAP_DIR, 'versions.yaml');
const SECTIONS_META_PATH = path.join(MAP_DIR, 'sections.yaml');
const NHSUK_NUNJUCKS_DIR = path.join(
  MAP_DIR,
  '..',
  'node_modules',
  'nhsuk-frontend',
  'dist'
);
const BUILD_STAMP_PATH = path.join(DIST_DIR, '.build-stamp.json');
const JOURNEY_VERSION_FILE_PATTERN = /^journey\.(.+)\.ya?ml$/i;

function buildMapSite() {
  const env = createTemplateEnvironment();
  const versionsMeta = loadVersionsMeta();
  const journeys = loadJourneys(versionsMeta);
  const sections = loadSectionsMeta(journeys);

  emptyDir(DIST_DIR);

  copyDirectory(ASSETS_DIR, path.join(DIST_DIR, 'assets'));
  copyJourneyScreenshots(journeys);
  prepareJourneysForRender(journeys, env);
  renderSite(journeys, sections, env);

  writeFile(
    path.join(DIST_DIR, 'site-data.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), journeys, sections }, null, 2)}\n`
  );

  writeFile(
    BUILD_STAMP_PATH,
    `${JSON.stringify({ sourceSignature: getSourceSignature() }, null, 2)}\n`
  );

  return {
    journeysCount: journeys.length,
    distDir: DIST_DIR
  };
}

function ensureMapBuilt() {
  const currentSignature = getSourceSignature();
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    buildMapSite();
    return;
  }

  try {
    const stamp = JSON.parse(fs.readFileSync(BUILD_STAMP_PATH, 'utf8'));
    if (stamp.sourceSignature !== currentSignature) {
      buildMapSite();
    }
  } catch (error) {
    buildMapSite();
  }
}

function getSourceSignature() {
  const sourcePaths = collectSourcePaths(MAP_DIR)
    .filter((filePath) => !filePath.startsWith(DIST_DIR))
    .sort();

  return sourcePaths
    .map((filePath) => `${path.relative(MAP_DIR, filePath)}:${fs.statSync(filePath).mtimeMs}`)
    .join('|');
}

function collectSourcePaths(dirPath) {
  const results = [];

  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.name === 'dist') {
      continue;
    }

    if (entry.isDirectory()) {
      results.push(...collectSourcePaths(fullPath));
    } else {
      results.push(fullPath);
    }
  }

  return results;
}

function loadJourneys(versionsMeta) {
  return listDirectories(JOURNEYS_DIR)
    .filter((journeySlug) => hasJourneyVersionFiles(path.join(JOURNEYS_DIR, journeySlug)))
    .map((journeySlug) => loadJourney(journeySlug, versionsMeta))
    .sort((left, right) => left.title.localeCompare(right.title));
}

function loadJourney(journeySlug, versionsMeta) {
  const journeyDir = path.join(JOURNEYS_DIR, journeySlug);
  const versionFiles = listJourneyVersionFiles(journeyDir);

  if (!versionFiles.length) {
    throw new Error(
      `Journey "${journeySlug}" must define at least one journey.vX.yaml file in ${journeyDir}`
    );
  }

  const versions = versionFiles
    .map((entry) => loadJourneyVersion({ journeyDir, journeySlug, entry, versionsMeta }))
    .sort((left, right) => compareVersionIds(left.version.id, right.version.id));

  const latestVersion = pickLatestVersion(versions);
  const latestAliasPath = `/map/journeys/${journeySlug}/`;

  return {
    slug: journeySlug,
    title: latestVersion.title,
    summary: latestVersion.summary,
    owner: latestVersion.owner,
    service: latestVersion.service,
    path: latestAliasPath,
    latestStepCount: latestVersion.steps.length,
    versionCount: versions.length,
    latestVersionId: latestVersion.version.id,
    latestVersionLabel: latestVersion.version.label,
    researchSummary: latestVersion.researchSummary,
    researchSummaryPreview: latestVersion.researchSummary.slice(0, 2),
    versions
  };
}

function loadJourneyVersion({ journeyDir, journeySlug, entry, versionsMeta }) {
  const journeyPath = path.join(journeyDir, entry.name);
  const config = readYaml(journeyPath);
  const versionId = requiredString(
    config.id || entry.versionId,
    `${journeyPath} -> id`
  );
  const versionMeta = versionsMeta[versionId];

  if (!versionMeta) {
    throw new Error(
      `Journey "${journeySlug}" uses version "${versionId}" but no matching metadata exists in ${VERSIONS_META_PATH}`
    );
  }

  const versionLabel = requiredString(
    versionMeta.label,
    `${VERSIONS_META_PATH} -> versions.${versionId}.label`
  );
  const stepOrder = normalizeStringArray(config.step_order, `${journeyPath} -> step_order`);

  if (!stepOrder.length) {
    throw new Error(`Journey version "${versionId}" must list at least one step in ${journeyPath}`);
  }

  const steps = stepOrder.map((stepSlug) =>
    loadStepVersion({
      journeyDir,
      journeySlug,
      stepSlug,
      versionId
    })
  );

  const findings = normalizeFindings(
    config.findings,
    journeyPath,
    versionLabel
  );

  applyFindingsToSteps({
    steps,
    findings,
    journeyPath,
    source: versionLabel
  });

  steps.forEach((step, index) => {
    step.position = index + 1;
  });

  return {
    slug: journeySlug,
    title: requiredString(config.title, `${journeyPath} -> title`),
    summary: optionalString(config.summary),
    owner: optionalString(config.owner),
    service: optionalString(config.service),
    version: {
      id: versionId,
      label: versionLabel,
      tag: optionalString(config.tag) || optionalString(versionMeta.tag)
    },
    journeyFindings: normalizeFindingGroup(
      config.journey_findings,
      `${journeyPath} -> journey_findings`,
      versionLabel
    ),
    researchSummary: normalizeFindingGroup(
      config.journey_findings,
      `${journeyPath} -> journey_findings`,
      versionLabel
    ).insights,
    findings,
    steps,
    path: `/map/journeys/${journeySlug}/versions/${versionId}/`,
    canonicalVersionPath: `/map/journeys/${journeySlug}/versions/${versionId}/`
  };
}

function loadVersionsMeta() {
  if (!fs.existsSync(VERSIONS_META_PATH)) {
    throw new Error(
      `The /map folder now requires a top-level versions metadata file at ${VERSIONS_META_PATH}`
    );
  }

  const data = readYaml(VERSIONS_META_PATH);
  const versions = data.versions || {};

  if (!isPlainObject(versions) || !Object.keys(versions).length) {
    throw new Error(`Missing required versions map in ${VERSIONS_META_PATH}`);
  }

  return versions;
}

function loadSectionsMeta(journeys) {
  if (!fs.existsSync(SECTIONS_META_PATH)) {
    throw new Error(
      `The /map folder now requires a top-level sections metadata file at ${SECTIONS_META_PATH}`
    );
  }

  const data = readYaml(SECTIONS_META_PATH);
  const sectionEntries = data.sections;

  if (!Array.isArray(sectionEntries) || !sectionEntries.length) {
    throw new Error(`Missing required sections list in ${SECTIONS_META_PATH}`);
  }

  const journeysBySlug = new Map(journeys.map((journey) => [journey.slug, journey]));
  const assignedJourneys = new Set();
  const sectionIds = new Set();

  const sections = sectionEntries.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw new Error(`${SECTIONS_META_PATH} -> sections[${index}] must be an object`);
    }

    const id = requiredString(
      entry.id || slugify(entry.title),
      `${SECTIONS_META_PATH} -> sections[${index}].id`
    );
    const title = requiredString(
      entry.title,
      `${SECTIONS_META_PATH} -> sections[${index}].title`
    );
    const journeySlugs = normalizeStringArray(
      entry.journeys || [],
      `${SECTIONS_META_PATH} -> sections[${index}].journeys`
    );

    if (sectionIds.has(id)) {
      throw new Error(`Section id "${id}" is used more than once in ${SECTIONS_META_PATH}`);
    }

    sectionIds.add(id);

    const sectionJourneys = journeySlugs.map((journeySlug) => {
      const journey = journeysBySlug.get(journeySlug);

      if (!journey) {
        throw new Error(
          `Section "${title}" in ${SECTIONS_META_PATH} references unknown journey "${journeySlug}"`
        );
      }

      if (assignedJourneys.has(journeySlug)) {
        throw new Error(
          `Journey "${journeySlug}" is assigned to more than one section in ${SECTIONS_META_PATH}`
        );
      }

      assignedJourneys.add(journeySlug);
      return journey;
    });

    return {
      id,
      title,
      journeys: sectionJourneys
    };
  });

  const unassignedJourneys = journeys
    .map((journey) => journey.slug)
    .filter((journeySlug) => !assignedJourneys.has(journeySlug));

  if (unassignedJourneys.length) {
    throw new Error(
      `Every journey must be assigned to a section in ${SECTIONS_META_PATH}. Missing: ${unassignedJourneys.join(', ')}`
    );
  }

  return sections;
}

function loadStepVersion({ journeyDir, journeySlug, stepSlug, versionId }) {
  const stepDir = path.join(journeyDir, stepSlug);
  const stepPath = path.join(stepDir, 'step.yaml');

  if (!fs.existsSync(stepPath)) {
    throw new Error(
      `Journey "${journeySlug}" references missing step "${stepSlug}" at ${stepPath}`
    );
  }

  const stepConfig = readYaml(stepPath);
  const resolvedVersion = resolveStepVersionConfig({
    stepConfig,
    stepPath,
    stepSlug,
    versionId
  });
  const versionConfig = resolvedVersion.config;

  const variants = ensureArray(versionConfig.variants).map((variant) =>
    normalizeVariant({
      variant,
      stepDir,
      stepPath,
      versionId: resolvedVersion.resolvedVersionId,
      stepTitle: requiredString(stepConfig.title, `${stepPath} -> title`)
    })
  );

  if (!variants.length) {
    throw new Error(
      `Step "${stepSlug}" must declare at least one variant in ${stepPath} -> versions.${versionId}.variants`
    );
  }

  const defaultVariantId = versionConfig.default_variant || variants[0].id;
  const defaultVariant = variants.find((variant) => variant.id === defaultVariantId);

  if (!defaultVariant) {
    throw new Error(
      `Step "${stepSlug}" sets default_variant "${defaultVariantId}" but no matching variant exists in ${stepPath} -> versions.${versionId}`
    );
  }

  return {
    slug: stepSlug,
    title: requiredString(stepConfig.title, `${stepPath} -> title`),
    summary: requiredString(
      versionConfig.summary,
      `${stepPath} -> versions.${resolvedVersion.resolvedVersionId}.summary`
    ),
    prototypePath: optionalString(versionConfig.prototype_path),
    notes: optionalString(versionConfig.notes),
    notesHtml: renderBasicMarkdown(optionalString(versionConfig.notes)),
    focusQuestions: normalizeStringArray(
      versionConfig.focus_questions,
      `${stepPath} -> versions.${resolvedVersion.resolvedVersionId}.focus_questions`
    ),
    variants,
    defaultVariantId,
    detailPath: `/map/journeys/${journeySlug}/versions/${versionId}/steps/${stepSlug}/`,
    requestedVersionId: versionId,
    screenVersionId: resolvedVersion.resolvedVersionId,
    isReusedFromEarlierVersion: resolvedVersion.resolvedVersionId !== versionId,
    linkedInsights: [],
    linkedNextSteps: []
  };
}

function resolveStepVersionConfig({ stepConfig, stepPath, stepSlug, versionId, stack = [] }) {
  const versions = stepConfig.versions || {};
  const requestedVersionId = versionId;
  const availableVersionId = versions[versionId]
    ? versionId
    : findClosestStepVersionId(Object.keys(versions), versionId);
  const versionConfig = availableVersionId ? versions[availableVersionId] : null;

  if (!versionConfig) {
    throw new Error(
      `Step "${stepSlug}" must define versions.${requestedVersionId} in ${stepPath}, or provide an earlier version to fall back to`
    );
  }

  if (!isPlainObject(versionConfig)) {
    throw new Error(
      `Step "${stepSlug}" versions.${availableVersionId} in ${stepPath} must be an object`
    );
  }

  const aliasTarget = optionalString(versionConfig.use);
  if (!aliasTarget) {
    return {
      config: versionConfig,
      resolvedVersionId: availableVersionId
    };
  }

  const keys = Object.keys(versionConfig);
  if (keys.length !== 1 || keys[0] !== 'use') {
    throw new Error(
      `Step "${stepSlug}" versions.${availableVersionId} in ${stepPath} must either define the version directly or contain only "use: <version-id>"`
    );
  }

  if (stack.includes(availableVersionId) || stack.includes(aliasTarget)) {
    throw new Error(
      `Step "${stepSlug}" has a circular version alias in ${stepPath}: ${[...stack, availableVersionId, aliasTarget].join(' -> ')}`
    );
  }

  return resolveStepVersionConfig({
    stepConfig,
    stepPath,
    stepSlug,
    versionId: aliasTarget,
    stack: [...stack, availableVersionId]
  });
}

function findClosestStepVersionId(versionIds, requestedVersionId) {
  const candidates = versionIds
    .filter((candidateId) => compareVersionIds(candidateId, requestedVersionId) <= 0)
    .sort(compareVersionIds);

  return candidates.at(-1) || '';
}

function normalizeVariant({ variant, stepDir, stepPath, versionId, stepTitle }) {
  const id = requiredString(variant.id, `${stepPath} -> versions.${versionId}.variants[].id`);
  const screenshotSource = requiredString(
    variant.screenshot,
    `${stepPath} -> versions.${versionId}.variants[].screenshot`
  );
  const screenshotAbsolutePath = path.join(stepDir, screenshotSource);

  if (!fs.existsSync(screenshotAbsolutePath)) {
    throw new Error(`Screenshot "${screenshotSource}" does not exist for ${stepPath}`);
  }

  return {
    id,
    label: requiredString(variant.label, `${stepPath} -> versions.${versionId}.variants[].label`),
    caption: optionalString(variant.caption),
    alt: optionalString(variant.alt) || defaultVariantAlt(stepTitle, variant.label),
    screenshotSource,
    screenshotAbsolutePath,
    insights: [],
    nextSteps: []
  };
}

function listJourneyVersionFiles(journeyDir) {
  return fs
    .readdirSync(journeyDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const match = JOURNEY_VERSION_FILE_PATTERN.exec(entry.name);
      if (!match) return null;
      return {
        name: entry.name,
        versionId: match[1]
      };
    })
    .filter(Boolean);
}

function hasJourneyVersionFiles(journeyDir) {
  return listJourneyVersionFiles(journeyDir).length > 0;
}

function normalizeFindingGroup(value, fieldName, source) {
  const group = value || {};
  return {
    insights: createResearchItems(
      normalizeStringArray(group.insights, `${fieldName}.insights`),
      source
    ),
    nextSteps: createResearchItems(
      normalizeStringArray(group.next_steps, `${fieldName}.next_steps`),
      source
    )
  };
}

function normalizeFindings(value, journeyPath, source) {
  return ensureArray(value).map((entry, index) => {
    const fieldName = `${journeyPath} -> findings[${index}]`;
    const scope = requiredString(entry.scope, `${fieldName}.scope`);
    const normalized = {
      scope,
      step: optionalString(entry.step),
      variant: optionalString(entry.variant),
      steps: normalizeStringArray(entry.steps, `${fieldName}.steps`),
      relatedSteps: normalizeStringArray(entry.related_steps, `${fieldName}.related_steps`),
      insights: createResearchItems(
        normalizeStringArray(entry.insights, `${fieldName}.insights`),
        source
      ),
      nextSteps: createResearchItems(
        normalizeStringArray(entry.next_steps, `${fieldName}.next_steps`),
        source
      )
    };

    if (!['step', 'variant', 'cross-step', 'dependency'].includes(scope)) {
      throw new Error(
        `${fieldName}.scope must be one of "step", "variant", "cross-step", or "dependency"`
      );
    }

    return normalized;
  });
}

function applyFindingsToSteps({ steps, findings, journeyPath }) {
  const stepsBySlug = new Map(steps.map((step) => [step.slug, step]));

  for (const step of steps) {
    step._stepInsights = [];
    step._stepNextSteps = [];
    step._linkedInsights = [];
    step._linkedNextSteps = [];
    step._stepInsightsSeen = new Set();
    step._stepNextStepsSeen = new Set();
    step._linkedInsightsSeen = new Set();
    step._linkedNextStepsSeen = new Set();
    step._variantFindings = {};

    for (const variant of step.variants) {
      step._variantFindings[variant.id] = {
        insights: [],
        nextSteps: [],
        insightsSeen: new Set(),
        nextStepsSeen: new Set()
      };
    }
  }

  for (const finding of findings) {
    if (finding.scope === 'step') {
      const step = getRequiredStep(stepsBySlug, finding.step, journeyPath, finding.scope);
      appendExistingResearchItems({
        target: step._stepInsights,
        seen: step._stepInsightsSeen,
        items: finding.insights
      });
      appendExistingResearchItems({
        target: step._stepNextSteps,
        seen: step._stepNextStepsSeen,
        items: finding.nextSteps
      });
      continue;
    }

    if (finding.scope === 'variant') {
      const step = getRequiredStep(stepsBySlug, finding.step, journeyPath, finding.scope);
      const variantStore = step._variantFindings[finding.variant];

      if (!variantStore) {
        throw new Error(
          `${journeyPath} -> findings references missing variant "${finding.variant}" on step "${finding.step}"`
        );
      }

      appendExistingResearchItems({
        target: variantStore.insights,
        seen: variantStore.insightsSeen,
        items: finding.insights
      });
      appendExistingResearchItems({
        target: variantStore.nextSteps,
        seen: variantStore.nextStepsSeen,
        items: finding.nextSteps
      });
      continue;
    }

    if (finding.scope === 'cross-step') {
      if (!finding.steps.length) {
        throw new Error(`${journeyPath} -> findings cross-step entry must list steps`);
      }

      for (const stepSlug of finding.steps) {
        const step = getRequiredStep(stepsBySlug, stepSlug, journeyPath, finding.scope);
        appendExistingResearchItems({
          target: step._linkedInsights,
          seen: step._linkedInsightsSeen,
          items: finding.insights
        });
        appendExistingResearchItems({
          target: step._linkedNextSteps,
          seen: step._linkedNextStepsSeen,
          items: finding.nextSteps
        });
      }
      continue;
    }

    if (finding.scope === 'dependency') {
      const step = getRequiredStep(stepsBySlug, finding.step, journeyPath, finding.scope);
      if (!finding.relatedSteps.length) {
        throw new Error(`${journeyPath} -> findings dependency entry must list related_steps`);
      }

      for (const relatedStepSlug of finding.relatedSteps) {
        getRequiredStep(stepsBySlug, relatedStepSlug, journeyPath, finding.scope);
      }

      appendExistingResearchItems({
        target: step._linkedInsights,
        seen: step._linkedInsightsSeen,
        items: finding.insights
      });
      appendExistingResearchItems({
        target: step._linkedNextSteps,
        seen: step._linkedNextStepsSeen,
        items: finding.nextSteps
      });
    }
  }

  for (const step of steps) {
    for (const variant of step.variants) {
      const variantStore = step._variantFindings[variant.id];
      variant.insights = mergeResearchItems(step._stepInsights, variantStore.insights);
      variant.nextSteps = mergeResearchItems(step._stepNextSteps, variantStore.nextSteps);
    }

    step.linkedInsights = step._linkedInsights;
    step.linkedNextSteps = step._linkedNextSteps;

    delete step._stepInsights;
    delete step._stepNextSteps;
    delete step._linkedInsights;
    delete step._linkedNextSteps;
    delete step._stepInsightsSeen;
    delete step._stepNextStepsSeen;
    delete step._linkedInsightsSeen;
    delete step._linkedNextStepsSeen;
    delete step._variantFindings;
  }
}

function getRequiredStep(stepsBySlug, stepSlug, journeyPath, scope) {
  if (!stepSlug) {
    throw new Error(`${journeyPath} -> findings ${scope} entry must declare a step`);
  }

  const step = stepsBySlug.get(stepSlug);
  if (!step) {
    throw new Error(
      `${journeyPath} -> findings ${scope} entry references missing step "${stepSlug}"`
    );
  }
  return step;
}

function appendExistingResearchItems({ target, seen, items }) {
  for (const item of items) {
    const key = `${item.source}:${item.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(item);
  }
}

function mergeResearchItems(...groups) {
  const merged = [];
  const seen = new Set();

  for (const group of groups) {
    for (const item of group || []) {
      const key = `${item.source}:${item.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
  }

  return merged;
}

function createResearchItems(items, source) {
  return items.map((text) => ({ text, source }));
}

function copyJourneyScreenshots(journeys) {
  for (const journey of journeys) {
    for (const version of journey.versions) {
      for (const step of version.steps) {
        const targetDir = path.join(
          DIST_DIR,
          'journeys',
          journey.slug,
          'steps',
          step.slug,
          'screenshots'
        );
        ensureDir(targetDir);

        for (const variant of step.variants) {
          const targetPath = path.join(targetDir, path.basename(variant.screenshotSource));
          fs.copyFileSync(variant.screenshotAbsolutePath, targetPath);
          variant.screenshotPath = `/map/journeys/${journey.slug}/steps/${step.slug}/screenshots/${path.basename(targetPath)}`;
        }
      }
    }
  }
}

function prepareJourneysForRender(journeys, env) {
  for (const journey of journeys) {
    journey.latestVersion = journey.versions.find(
      (version) => version.version.id === journey.latestVersionId
    );

    for (const version of journey.versions) {
      version.researchSummaryPreview = version.researchSummary.slice(0, 2);

      for (const step of version.steps) {
        step.defaultVariant = step.variants.find((variant) => variant.id === step.defaultVariantId);
        step.variantIndexJson = serializeForScript(indexVariants(step.variants, env));

        for (const variant of step.variants) {
          variant.isDefaultVariant = variant.id === step.defaultVariantId;
        }
      }
    }
  }
}

function createTemplateEnvironment() {
  const env = nunjucks.configure([TEMPLATES_DIR, NHSUK_NUNJUCKS_DIR], {
    autoescape: true,
    noCache: true
  });

  env.addFilter('jsonScript', serializeForScript);

  return env;
}

function renderSite(journeys, sections, env) {
  writeFile(
    path.join(DIST_DIR, 'index.html'),
    env.render('pages/overview.njk', {
      pageTitle: 'User journeys overview',
      description:
        'A generated map site that reads versioned journey YAML and step YAML to build overview, journey, and step detail pages.',
      bodyClass: 'map-site--overview',
      breadcrumbs: [],
      breadcrumbParams: null,
      journeys,
      sections
    })
  );

  for (const journey of journeys) {
    const latestModel = createJourneyRenderModel({
      journey,
      version: journey.latestVersion,
      journeyPath: journey.path,
      stepPathBase: `/map/journeys/${journey.slug}/steps`
    });

    writeJourneyVersionFiles({
      env,
      versionModel: latestModel,
      journeySlug: journey.slug,
      outputDir: path.join(DIST_DIR, 'journeys', journey.slug)
    });

    for (const version of journey.versions) {
      const versionModel = createJourneyRenderModel({
        journey,
        version,
        journeyPath: version.canonicalVersionPath,
        stepPathBase: `/map/journeys/${journey.slug}/versions/${version.version.id}/steps`
      });

      writeJourneyVersionFiles({
        env,
        versionModel,
        journeySlug: journey.slug,
        outputDir: path.join(DIST_DIR, 'journeys', journey.slug, 'versions', version.version.id)
      });
    }
  }
}

function writeJourneyVersionFiles({ env, versionModel, outputDir }) {
  writeFile(
    path.join(outputDir, 'index.html'),
    env.render('pages/journey.njk', {
      pageTitle: versionModel.title,
      description: versionModel.summary,
      bodyClass: 'map-site--journey',
      breadcrumbs: [
        { label: 'All journeys', href: '/map/' },
        { label: versionModel.title }
      ],
      breadcrumbParams: toBreadcrumbParams([{ label: 'All journeys', href: '/map/' }]),
      journey: versionModel
    })
  );

  for (const step of versionModel.steps) {
    writeFile(
      path.join(outputDir, 'steps', step.slug, 'index.html'),
      env.render('pages/step.njk', {
        pageTitle: `${versionModel.title} - ${step.title}`,
        description: step.summary,
        bodyClass: 'map-site--step',
        breadcrumbs: [
          { label: 'All journeys', href: '/map/' },
          { label: versionModel.title, href: versionModel.path },
          { label: step.title }
        ],
        breadcrumbParams: toBreadcrumbParams([
          { label: 'All journeys', href: '/map/' },
          { label: versionModel.title, href: versionModel.path }
        ]),
        journey: versionModel,
        step
      })
    );
  }
}

function createJourneyRenderModel({ journey, version, journeyPath, stepPathBase }) {
  return {
    ...version,
    slug: journey.slug,
    path: journeyPath,
    versionCount: journey.versionCount,
    versions: journey.versions.map((entry) => ({
      id: entry.version.id,
      label: entry.version.label,
      tag: entry.version.tag,
      path:
        entry.version.id === journey.latestVersionId
          ? `/map/journeys/${journey.slug}/`
          : `/map/journeys/${journey.slug}/versions/${entry.version.id}/`
    })),
    steps: version.steps.map((step) => ({
      ...step,
      detailPath: `${stepPathBase}/${step.slug}/`
    }))
  };
}

function indexVariants(variants, env) {
  return variants.reduce((result, variant) => {
    result[variant.id] = {
      label: variant.label,
      caption: variant.caption,
      alt: variant.alt,
      screenshotPath: variant.screenshotPath,
      insightsHtml: renderBoardNotesHtml(env, variant.insights, 'None for this version'),
      nextStepsHtml: renderBoardNotesHtml(env, variant.nextSteps, 'None for this version')
    };
    return result;
  }, {});
}

function renderBoardNotesHtml(env, items, emptyMessage) {
  return env
    .renderString(
      '{% from "components/macros.njk" import boardNotes %}{{ boardNotes(items, emptyMessage) }}',
      { items, emptyMessage }
    )
    .trim();
}

function pickLatestVersion(versions) {
  const tagged = versions.filter(
    (version) => version.version.tag && version.version.tag.toLowerCase() === 'latest'
  );

  if (tagged.length) {
    return tagged.sort((left, right) => compareVersionIds(left.version.id, right.version.id)).at(-1);
  }

  return versions.at(-1);
}

function compareVersionIds(left, right) {
  const leftMatch = /^v(\d+)$/i.exec(left);
  const rightMatch = /^v(\d+)$/i.exec(right);

  if (leftMatch && rightMatch) {
    return Number(leftMatch[1]) - Number(rightMatch[1]);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function copyDirectory(sourceDir, targetDir) {
  ensureDir(targetDir);
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
}

function listDirectories(dirPath) {
  return fs
    .readdirSync(dirPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === '') return [];
  return [value];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeStringArray(value, fieldName) {
  return ensureArray(value)
    .map((item) => requiredString(item, fieldName))
    .filter(Boolean);
}

function requiredString(value, fieldName) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`Missing required value for ${fieldName}`);
  }
  return normalized;
}

function optionalString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function renderBasicMarkdown(markdown) {
  const source = optionalString(markdown).replace(/\r\n/g, '\n');

  if (!source) {
    return '';
  }

  const blocks = [];
  const paragraphLines = [];
  const listItems = [];

  function flushParagraph() {
    if (!paragraphLines.length) return;
    blocks.push(`<p>${escapeHtml(paragraphLines.join(' '))}</p>`);
    paragraphLines.length = 0;
  }

  function flushList() {
    if (!listItems.length) return;
    blocks.push(
      `<ul class="map-bullet-list">${listItems
        .map((item) => `<li>${escapeHtml(item)}</li>`)
        .join('')}</ul>`
    );
    listItems.length = 0;
  }

  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    if (line.startsWith('- ')) {
      flushParagraph();
      listItems.push(line.slice(2).trim());
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return blocks.join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emptyDir(dirPath) {
  ensureDir(dirPath);
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const entryPath = path.join(dirPath, entry.name);
    fs.rmSync(entryPath, { recursive: true, force: true });
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function serializeForScript(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function defaultVariantAlt(stepTitle, variantLabel) {
  const cleanStepTitle = optionalString(stepTitle);
  const cleanVariantLabel = optionalString(variantLabel);

  if (!cleanVariantLabel || cleanVariantLabel.toLowerCase() === 'default view') {
    return `Screenshot of ${cleanStepTitle}`;
  }

  return `Screenshot of ${cleanStepTitle} - ${cleanVariantLabel}`;
}

function toBreadcrumbParams(items) {
  if (!items || !items.length) {
    return null;
  }

  return {
    items: items
      .filter((item) => item.href)
      .map((item) => ({
        href: item.href,
        text: item.label
      })),
    backLink: {
      classes: 'map-breadcrumb-back-link'
    }
  };
}

if (require.main === module) {
  const result = buildMapSite();
  console.log(`Built map site with ${result.journeysCount} journey(s) into ${result.distDir}`);
}

module.exports = {
  buildMapSite,
  ensureMapBuilt
};
