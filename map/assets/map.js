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

function updateVariant(stepSlug, variantData) {
  const screenshot = document.querySelector(`[data-map-screenshot="${stepSlug}"] img`);
  const insights = document.querySelector(`[data-map-insights="${stepSlug}"]`);
  const nextSteps = document.querySelector(`[data-map-next="${stepSlug}"]`);
  const detailScreenshot = document.querySelector(`[data-map-detail-screenshot="${stepSlug}"]`);
  const detailInsights = document.querySelector(`[data-map-detail-insights="${stepSlug}"]`);
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

  if (detailScreenshot) {
    renderHtml(detailScreenshot, variantData.detailScreenshotHtml);
  }

  if (detailInsights) {
    renderHtml(detailInsights, variantData.detailInsightsHtml);
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

  if (defaultVariantId && variantIndex[defaultVariantId]) {
    selectElement.value = defaultVariantId;
    updateVariant(stepSlug, variantIndex[defaultVariantId]);
  }

  selectElement.addEventListener('change', () => {
    const selectedVariant = variantIndex[selectElement.value];
    if (selectedVariant) {
      updateVariant(stepSlug, selectedVariant);
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
