function renderHtml(target, html) {
  if (!target) return;
  target.innerHTML = html || '';
}

function updateVariant(stepSlug, variantData) {
  const screenshot = document.querySelector(`[data-map-screenshot="${stepSlug}"] img`);
  const insights = document.querySelector(`[data-map-insights="${stepSlug}"]`);
  const nextSteps = document.querySelector(`[data-map-next="${stepSlug}"]`);
  const detailScreenshot = document.querySelector(`[data-map-detail-screenshot="${stepSlug}"]`);
  const detailInsights = document.querySelector(`[data-map-detail-insights="${stepSlug}"]`);

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
}

document.querySelectorAll('.js-map-variant-select').forEach((selectElement) => {
  const stepSlug = selectElement.dataset.stepSlug;
  const defaultVariantId = selectElement.dataset.defaultVariantId;
  const dataElement = selectElement.parentElement.querySelector('.js-map-variant-data');

  if (!stepSlug || !dataElement) {
    return;
  }

  const variantIndex = JSON.parse(dataElement.textContent);

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

document.querySelectorAll('.js-map-version-select').forEach((selectElement) => {
  selectElement.addEventListener('change', () => {
    const targetPath = selectElement.value;
    if (targetPath) {
      window.location.assign(targetPath);
    }
  });
});
