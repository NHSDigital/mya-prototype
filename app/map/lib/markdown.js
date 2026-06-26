// -----------------------------------------------------------------------------
// Markdown rendering for the /map site
// -----------------------------------------------------------------------------
// Renders per-journey insights.md / implementation.md into HTML that is injected
// into the map templates' `.map-rich-text` container (NHS-styled in map.css).
// Uses markdown-it (already a dependency); no govuk-prototype-filters.
//
// Optional convention: a heading line `## step: <step-id>` splits a doc so a
// given step's page can show just its slice. `getDocHtml(dir, name, stepId)`
// returns the step slice if present, else the whole doc.
// -----------------------------------------------------------------------------

const fs = require('node:fs');
const path = require('node:path');
const MarkdownIt = require('markdown-it');

const md = new MarkdownIt({ html: false, linkify: true, typographer: true });

const STEP_HEADING = /^##\s+step:\s*([a-z0-9][a-z0-9-]*)\s*$/i;

function readDoc(dir, name) {
  const file = path.join(dir, name);
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

// Split a markdown doc into { _intro, <stepId>: <markdown> } on `## step: <id>` headings.
function splitByStep(source) {
  const lines = source.split('\n');
  const sections = { _intro: [] };
  let current = '_intro';
  for (const line of lines) {
    const match = line.match(STEP_HEADING);
    if (match) {
      current = match[1].toLowerCase();
      sections[current] = sections[current] || [];
      continue;
    }
    sections[current] = sections[current] || [];
    sections[current].push(line);
  }
  const out = {};
  for (const key of Object.keys(sections)) out[key] = sections[key].join('\n').trim();
  return out;
}

function renderMarkdown(source) {
  const trimmed = String(source || '').trim();
  if (!trimmed) return '';
  return md.render(trimmed);
}

// Return rendered HTML for a journey doc. If stepId is given and the doc has a
// matching `## step: <id>` section, return intro + that section; else the whole doc.
function getDocHtml(dir, name, stepId) {
  const source = readDoc(dir, name);
  if (!source.trim()) return '';
  if (!STEP_HEADING.test(source) || !stepId) return renderMarkdown(source);

  const sections = splitByStep(source);
  const parts = [];
  if (sections._intro) parts.push(sections._intro);
  if (sections[stepId]) parts.push(sections[stepId]);
  return renderMarkdown(parts.join('\n\n'));
}

function hasDoc(dir, name) {
  return Boolean(readDoc(dir, name).trim());
}

module.exports = { renderMarkdown, getDocHtml, hasDoc };
