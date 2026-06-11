function renderHtml(target, html) {
  if (!target) return;
  target.innerHTML = html || '';
}

function getControlDataElement(selectElement) {
  const controlElement = selectElement.closest('[data-map-control]');
  if (controlElement) {
    return controlElement.querySelector('[data-map-variant-data], .js-map-variant-data');
  }

  return selectElement.parentElement
    ? selectElement.parentElement.querySelector('[data-map-variant-data], .js-map-variant-data')
    : null;
}

function getVariantIdFromQuery(variantIndex) {
  const params = new URLSearchParams(window.location.search || '');
  const candidate = params.get('variant') || '';

  return Object.prototype.hasOwnProperty.call(variantIndex, candidate) ? candidate : '';
}

function setVariantQuery(variantId) {
  if (!variantId) return;

  const currentUrl = new URL(window.location.href);
  if (currentUrl.searchParams.get('variant') === variantId) return;

  currentUrl.searchParams.set('variant', variantId);
  const nextUrl = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;

  if (window.history && typeof window.history.replaceState === 'function') {
    window.history.replaceState(null, '', nextUrl);
    return;
  }

  window.location.assign(nextUrl);
}

function updateVariant(stepSlug, variantData) {
  const screenshot = document.querySelector(`[data-map-screenshot="${stepSlug}"] img`);
  const insights = document.querySelector(`[data-map-insights="${stepSlug}"]`);
  const nextSteps = document.querySelector(`[data-map-next="${stepSlug}"]`);
  const notes = document.querySelector(`[data-map-notes="${stepSlug}"]`);
  const detailScreenshot = document.querySelector(`[data-map-detail-screenshot="${stepSlug}"]`);
  const detailInsights = document.querySelector(`[data-map-detail-insights="${stepSlug}"]`);
  const detailNotes = document.querySelector(`[data-map-detail-notes="${stepSlug}"]`);
  const detailImplementation = document.querySelector(`[data-map-detail-implementation="${stepSlug}"]`);

  if (screenshot) {
    screenshot.src = variantData.screenshotPath;
    screenshot.alt = variantData.alt;
  }

  if (insights) {
    renderHtml(insights, variantData.insightsHtml);
  }

  if (nextSteps) {
    renderHtml(nextSteps, variantData.nextStepsHtml);
  }

  if (notes) {
    renderHtml(notes, variantData.notesHtml);
  }

  if (detailScreenshot) {
    renderHtml(detailScreenshot, variantData.detailScreenshotHtml);
  }

  if (detailInsights) {
    renderHtml(detailInsights, variantData.detailInsightsHtml);
  }

  if (detailNotes) {
    const notesHtml = variantData.notesHtml || '<p class="map-empty-state">None for this version</p>';
    renderHtml(detailNotes, `<div class="map-rich-text">${notesHtml}</div>`);
  }

  if (detailImplementation) {
    renderHtml(detailImplementation, variantData.detailImplementationHtml);
  }
}

document.querySelectorAll('[data-map-variant-select], .js-map-variant-select').forEach((selectElement) => {
  const stepSlug = selectElement.dataset.mapStepSlug || selectElement.dataset.stepSlug;
  const defaultVariantId = selectElement.dataset.mapDefaultVariantId || selectElement.dataset.defaultVariantId;
  const dataElement = getControlDataElement(selectElement);

  if (!stepSlug || !dataElement || !dataElement.textContent) {
    return;
  }

  let variantIndex;

  try {
    variantIndex = JSON.parse(dataElement.textContent);
  } catch {
    return;
  }

  const queryVariantId = getVariantIdFromQuery(variantIndex);
  const initialVariantId =
    queryVariantId
    || (defaultVariantId && variantIndex[defaultVariantId] ? defaultVariantId : '')
    || (variantIndex[selectElement.value] ? selectElement.value : '')
    || Object.keys(variantIndex)[0];

  if (initialVariantId && variantIndex[initialVariantId]) {
    selectElement.value = initialVariantId;
    updateVariant(stepSlug, variantIndex[initialVariantId]);
  }

  selectElement.addEventListener('change', () => {
    const selectedVariantId = selectElement.value;
    const selectedVariant = variantIndex[selectedVariantId];
    if (selectedVariant) {
      updateVariant(stepSlug, selectedVariant);
      setVariantQuery(selectedVariantId);
    }
  });
});

document.querySelectorAll('[data-map-version-select], .js-map-version-select').forEach((selectElement) => {
  selectElement.addEventListener('change', () => {
    const targetPath = selectElement.value;
    if (targetPath) {
      window.location.assign(targetPath);
    }
  });
});
