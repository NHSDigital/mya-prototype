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
const BROWSER_RELOAD_TRIGGER_PATH = path.join(MAP_DIR, '..', 'app', 'assets', 'map-reload-trigger.txt');
const JOURNEY_VERSION_FILE_PATTERN = /^journey\.(.+)\.ya?ml$/i;

class MapValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MapValidationError';
  }
}

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

  if ((process.env.NODE_ENV || 'development') !== 'production') {
    writeFile(BROWSER_RELOAD_TRIGGER_PATH, `${new Date().toISOString()}\n`);
  }

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
    throw new MapValidationError(
      [
        `Missing required file: ${VERSIONS_META_PATH}`,
        'Expected a top-level versions metadata file like:',
        'versions:',
        '  v1:',
        '    label: Round 1 testing'
      ].join('\n')
    );
  }

  const data = readYaml(VERSIONS_META_PATH);
  const versions = data.versions || {};

  if (!isPlainObject(versions) || !Object.keys(versions).length) {
    throw validationError(`${VERSIONS_META_PATH} -> versions`, 'Expected a non-empty object map of version ids.');
  }

  return versions;
}

function loadSectionsMeta(journeys) {
  if (!fs.existsSync(SECTIONS_META_PATH)) {
    throw new MapValidationError(
      [
        `Missing required file: ${SECTIONS_META_PATH}`,
        'Expected a top-level sections file like:',
        'sections:',
        '  - title: Global',
        '    journeys:',
        '      - navigation'
      ].join('\n')
    );
  }

  const data = readYaml(SECTIONS_META_PATH);
  const sectionEntries = data.sections;

  if (!Array.isArray(sectionEntries) || !sectionEntries.length) {
    throw validationError(`${SECTIONS_META_PATH} -> sections`, 'Expected a non-empty list of sections.');
  }

  const journeysBySlug = new Map(journeys.map((journey) => [journey.slug, journey]));
  const assignedJourneys = new Set();
  const sectionIds = new Set();

  const sections = sectionEntries.map((entry, index) => {
    if (!isPlainObject(entry)) {
      throw validationError(
        `${SECTIONS_META_PATH} -> sections[${index}]`,
        'Expected each section entry to be an object.',
        { actual: entry }
      );
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
      throw validationError(
        `${SECTIONS_META_PATH} -> sections[${index}].id`,
        `Section id "${id}" is used more than once.`,
        { actual: id }
      );
    }

    sectionIds.add(id);

    const sectionJourneys = journeySlugs.map((journeySlug) => {
      const journey = journeysBySlug.get(journeySlug);

      if (!journey) {
        throw validationError(
          `${SECTIONS_META_PATH} -> sections[${index}].journeys`,
          `Unknown journey slug "${journeySlug}".`,
          {
            actual: journeySlug,
            expected: formatList(journeys.map((entry) => entry.slug))
          }
        );
      }

      if (assignedJourneys.has(journeySlug)) {
        throw validationError(
          `${SECTIONS_META_PATH} -> sections[${index}].journeys`,
          `Journey "${journeySlug}" is assigned to more than one section.`,
          { actual: journeySlug }
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
    throw new MapValidationError(
      [
        `Every journey must be assigned to a section in ${SECTIONS_META_PATH}.`,
        `Missing journey slugs: ${formatList(unassignedJourneys)}`
      ].join('\n')
    );
  }

  return sections;
}

function loadStepVersion({ journeyDir, journeySlug, stepSlug, versionId }) {
  const stepDir = path.join(journeyDir, stepSlug);
  const stepPath = path.join(stepDir, 'step.yaml');

  if (!fs.existsSync(stepPath)) {
    throw new MapValidationError(
      [
        `Journey "${journeySlug}" references a missing step "${stepSlug}".`,
        `Expected step file: ${stepPath}`,
        `Available step folders: ${formatList(listDirectories(journeyDir).filter((entry) => entry !== 'screenshots'))}`
      ].join('\n')
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

  const rawVariants = ensureArray(versionConfig.variants);
  const variants = rawVariants.map((variant, variantIndex) =>
    normalizeVariant({
      variant,
      variantIndex,
      stepDir,
      stepPath,
      versionId: resolvedVersion.resolvedVersionId,
      stepTitle: requiredString(stepConfig.title, `${stepPath} -> title`)
    })
  );

  if (!variants.length) {
    throw validationError(
      `${stepPath} -> versions.${versionId}.variants`,
      `Step "${stepSlug}" must declare at least one variant.`
    );
  }

  const defaultVariantId = versionConfig.default_variant || variants[0].id;
  const defaultVariant = variants.find((variant) => variant.id === defaultVariantId);

  if (!defaultVariant) {
    throw validationError(
      `${stepPath} -> versions.${versionId}.default_variant`,
      `No matching variant exists for default_variant "${defaultVariantId}".`,
      {
        actual: defaultVariantId,
        expected: formatList(variants.map((variant) => variant.id))
      }
    );
  }

  const implementation = normalizeImplementation({
    value: versionConfig.implementation,
    versionConfig,
    stepPath,
    versionId: resolvedVersion.resolvedVersionId,
    defaultVariant,
    defaultPrototypePath: optionalString(versionConfig.prototype_path)
  });

  const variantsWithImplementation = variants.map((variant, variantIndex) => {
    const rawVariant = rawVariants[variantIndex] || {};
    const hasVariantImplementation =
      isPlainObject(rawVariant) && Object.prototype.hasOwnProperty.call(rawVariant, 'implementation');

    return {
      ...variant,
      implementation: normalizeImplementation({
        value: hasVariantImplementation ? rawVariant.implementation : versionConfig.implementation,
        versionConfig,
        stepPath,
        versionId: resolvedVersion.resolvedVersionId,
        defaultVariant: variant,
        defaultPrototypePath: optionalString(versionConfig.prototype_path),
        fieldName: hasVariantImplementation
          ? `${stepPath} -> versions.${resolvedVersion.resolvedVersionId}.variants[${variantIndex}].implementation`
          : `${stepPath} -> versions.${resolvedVersion.resolvedVersionId}.implementation`
      })
    };
  });

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
    status: optionalString(versionConfig.status),
    implementation,
    focusQuestions: normalizeStringArray(
      versionConfig.focus_questions,
      `${stepPath} -> versions.${resolvedVersion.resolvedVersionId}.focus_questions`
    ),
    variants: variantsWithImplementation,
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
    throw new MapValidationError(
      [
        `Step "${stepSlug}" does not define a usable version for "${requestedVersionId}".`,
        `Checked file: ${stepPath}`,
        `Available versions: ${formatList(Object.keys(versions))}`,
        'Add versions.<id> for this step, or define an earlier version that can be reused.'
      ].join('\n')
    );
  }

  if (!isPlainObject(versionConfig)) {
    throw validationError(
      `${stepPath} -> versions.${availableVersionId}`,
      'Expected a version block object.',
      { actual: versionConfig }
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
    throw validationError(
      `${stepPath} -> versions.${availableVersionId}`,
      'A version alias must contain only "use: <version-id>", with no other fields.',
      { actual: versionConfig }
    );
  }

  if (stack.includes(availableVersionId) || stack.includes(aliasTarget)) {
    throw new MapValidationError(
      `Step "${stepSlug}" has a circular version alias in ${stepPath}: ${[
        ...stack,
        availableVersionId,
        aliasTarget
      ].join(' -> ')}`
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

function normalizeVariant({ variant, stepDir, stepPath, versionId, stepTitle, variantIndex }) {
  const variantField = `${stepPath} -> versions.${versionId}.variants[${variantIndex}]`;
  if (!isPlainObject(variant)) {
    throw validationError(variantField, 'Expected each variant entry to be an object.', {
      actual: variant
    });
  }
  const id = requiredString(variant.id, `${variantField}.id`);
  const screenshotSource = requiredString(
    variant.screenshot,
    `${variantField}.screenshot`
  );
  const screenshotAbsolutePath = path.join(stepDir, screenshotSource);

  if (!fs.existsSync(screenshotAbsolutePath)) {
    throw new MapValidationError(
      [
        `Referenced screenshot does not exist.`,
        `Field: ${variantField}.screenshot`,
        `Value: ${formatValue(screenshotSource)}`,
        `Expected file: ${screenshotAbsolutePath}`
      ].join('\n')
    );
  }

  return {
    id,
    label: requiredString(variant.label, `${variantField}.label`),
    caption: optionalString(variant.caption),
    alt: optionalString(variant.alt) || defaultVariantAlt(stepTitle, variant.label),
    screenshotSource,
    screenshotAbsolutePath,
    insights: [],
    nextSteps: []
  };
}

function normalizeImplementation({
  value,
  versionConfig,
  stepPath,
  versionId,
  defaultVariant,
  defaultPrototypePath,
  fieldName
}) {
  const resolvedFieldName = fieldName || `${stepPath} -> versions.${versionId}.implementation`;
  const implementation = value || {};

  if (value && !isPlainObject(value)) {
    throw validationError(resolvedFieldName, 'Expected implementation to be an object.', {
      actual: value
    });
  }

  const prototypeLinkValue = implementation.prototype_link || {};
  if (implementation.prototype_link && !isPlainObject(prototypeLinkValue)) {
    throw validationError(`${resolvedFieldName}.prototype_link`, 'Expected prototype_link to be an object.', {
      actual: implementation.prototype_link
    });
  }

  const ticketValue = implementation.ticket || {};
  if (implementation.ticket && !isPlainObject(ticketValue)) {
    throw validationError(`${resolvedFieldName}.ticket`, 'Expected ticket to be an object.', {
      actual: implementation.ticket
    });
  }

  const userStory = normalizeStringArray(
    implementation.user_story,
    `${resolvedFieldName}.user_story`
  );

  const notableComponents = ensureArray(implementation.notable_components).map((entry, index) =>
    normalizeImplementationLink(
      entry,
      `${resolvedFieldName}.notable_components[${index}]`
    )
  );

  const acceptanceCriteria = ensureArray(implementation.acceptance_criteria).map((entry, index) =>
    normalizeAcceptanceCriterion(entry, `${resolvedFieldName}.acceptance_criteria[${index}]`)
  );

  const prototypeLink = normalizeImplementationLink(
    {
      label:
        optionalString(prototypeLinkValue.label) ||
        optionalString(defaultVariant?.label) ||
        optionalString(versionConfig.summary),
      href: optionalString(prototypeLinkValue.href) || defaultPrototypePath
    },
    `${resolvedFieldName}.prototype_link`,
    { allowBlank: true }
  );

  const ticket = normalizeImplementationLink(
    ticketValue,
    `${resolvedFieldName}.ticket`,
    { allowBlank: true }
  );

  const notes = optionalString(implementation.notes) || optionalString(versionConfig.notes);
  const notesHtml = renderBasicMarkdown(notes);

  return {
    ticket,
    userStory,
    prototypeLink,
    notableComponents,
    acceptanceCriteria,
    notes,
    notesHtml,
    hasOverview:
      Boolean(ticket.label) ||
      Boolean(prototypeLink.label) ||
      notableComponents.length > 0 ||
      userStory.length > 0
  };
}

function normalizeImplementationLink(value, fieldName, options = {}) {
  const allowBlank = Boolean(options.allowBlank);
  const data = value || {};

  if (!isPlainObject(data)) {
    throw validationError(fieldName, 'Expected a link-style object with optional label and href.', {
      actual: value
    });
  }

  const label = optionalString(data.label);
  const href = optionalString(data.href);

  if (!allowBlank && !label) {
    throw validationError(`${fieldName}.label`, 'Expected a non-empty string.', {
      actual: data.label
    });
  }

  return { label, href };
}

function normalizeAcceptanceCriterion(value, fieldName) {
  if (!isPlainObject(value)) {
    throw validationError(fieldName, 'Expected an acceptance criteria entry to be an object.', {
      actual: value
    });
  }

  return {
    id: requiredString(value.id, `${fieldName}.id`),
    given: optionalString(value.given),
    when: optionalString(value.when),
    then: normalizeStringArray(value.then, `${fieldName}.then`)
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
        throw validationError(
          `${journeyPath} -> findings`,
          `Missing variant "${finding.variant}" on step "${finding.step}".`,
          {
            actual: finding.variant,
            expected: formatList(step.variants.map((variant) => variant.id))
          }
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
        throw validationError(
          `${journeyPath} -> findings cross-step`,
          'A cross-step finding must list one or more step slugs in "steps".'
        );
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
        throw validationError(
          `${journeyPath} -> findings dependency`,
          'A dependency finding must list one or more step slugs in "related_steps".'
        );
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
    throw validationError(
      `${journeyPath} -> findings ${scope}`,
      'This finding must declare a step slug in "step".'
    );
  }

  const step = stepsBySlug.get(stepSlug);
  if (!step) {
    throw validationError(
      `${journeyPath} -> findings ${scope}.step`,
      `Unknown step slug "${stepSlug}".`,
      {
        actual: stepSlug,
        expected: formatList([...stepsBySlug.keys()])
      }
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
        step.versionOptions = journey.versions
          .filter((entry) => entry.steps.some((candidateStep) => candidateStep.slug === step.slug))
          .map((entry) => ({
            id: entry.version.id,
            label: entry.version.label,
            tag: entry.version.tag,
            path:
              entry.version.id === journey.latestVersionId
                ? `/map/journeys/${journey.slug}/steps/${step.slug}/`
                : `/map/journeys/${journey.slug}/versions/${entry.version.id}/steps/${step.slug}/`
          }));

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
  const steps = version.steps.map((step) => ({
    ...step,
    detailPath: `${stepPathBase}/${step.slug}/`
  }));

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
    steps: steps.map((step, index) => ({
      ...step,
      previousStep: index > 0 ? steps[index - 1] : null,
      nextStep: index < steps.length - 1 ? steps[index + 1] : null
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
      nextStepsHtml: renderBoardNotesHtml(env, variant.nextSteps, 'None for this version'),
      detailScreenshotHtml: renderStepVariantScreenshotHtml(env, variant),
      detailInsightsHtml: renderStepVariantResearchHtml(env, variant),
      detailImplementationHtml: renderStepImplementationHtml(env, variant.implementation)
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

function renderStepVariantScreenshotHtml(env, variant) {
  return env
    .renderString(
      '{% from "components/macros.njk" import stepVariantScreenshot %}{{ stepVariantScreenshot(variant) }}',
      { variant }
    )
    .trim();
}

function renderStepVariantResearchHtml(env, variant) {
  return env
    .renderString(
      '{% from "components/macros.njk" import stepVariantResearch %}{{ stepVariantResearch(variant) }}',
      { variant }
    )
    .trim();
}

function renderStepImplementationHtml(env, implementation) {
  return env
    .renderString(
      '{% from "components/macros.njk" import stepImplementationPanel %}{{ stepImplementationPanel(step) }}',
      {
        step: {
          implementation
        }
      }
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
  try {
    return yaml.load(fs.readFileSync(filePath, 'utf8')) || {};
  } catch (error) {
    const line = error.mark ? error.mark.line + 1 : null;
    const column = error.mark ? error.mark.column + 1 : null;
    throw new MapValidationError(
      [
        `Invalid YAML in ${filePath}`,
        line && column ? `Location: line ${line}, column ${column}` : '',
        error.reason ? `Problem: ${error.reason}` : error.message
      ]
        .filter(Boolean)
        .join('\n')
    );
  }
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
    .map((item, index) => requiredString(item, `${fieldName}[${index}]`))
    .filter(Boolean);
}

function requiredString(value, fieldName) {
  const normalized = optionalString(value);
  if (!normalized) {
    throw validationError(fieldName, 'Expected a non-empty string.', { actual: value });
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

function validationError(fieldName, message, details = {}) {
  const lines = [`Invalid map data at ${fieldName}`, message];

  if ('actual' in details) {
    lines.push(`Received: ${formatValue(details.actual)}`);
  }

  if (details.expected) {
    lines.push(`Expected: ${details.expected}`);
  }

  if (details.hint) {
    lines.push(`Hint: ${details.hint}`);
  }

  return new MapValidationError(lines.join('\n'));
}

function formatValue(value) {
  if (value === undefined) return 'undefined';
  if (value === null) return 'null';
  if (typeof value === 'string') return JSON.stringify(value);

  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function formatList(values) {
  return values && values.length ? values.join(', ') : '(none)';
}

if (require.main === module) {
  try {
    const result = buildMapSite();
    console.log(`Built map site with ${result.journeysCount} journey(s) into ${result.distDir}`);
  } catch (error) {
    if (error instanceof MapValidationError) {
      console.error(error.message);
      process.exit(1);
    }

    throw error;
  }
}

module.exports = {
  buildMapSite,
  ensureMapBuilt
};
