function renderResearchList(items, emptyMessage) {
  if (!Array.isArray(items) || !items.length) {
    return `<p class="map-empty-state">${emptyMessage}</p>`;
  }

  const content = items
    .map(
      (item) => `
        <li>
          <p>${escapeHtml(item.text)}</p>
          <small>${escapeHtml(item.source)}</small>
        </li>
      `
    )
    .join('');

  return `<ul class="map-board-notes">${content}</ul>`;
}

function updateVariant(stepSlug, variantData) {
  const screenshot = document.querySelector(`[data-map-screenshot="${stepSlug}"] img`);
  const insights = document.querySelector(`[data-map-insights="${stepSlug}"]`);
  const nextSteps = document.querySelector(`[data-map-next="${stepSlug}"]`);

  if (screenshot) {
    screenshot.src = variantData.screenshotPath;
    screenshot.alt = variantData.alt;
  }

  if (insights) {
    insights.innerHTML = `
      <h3 class="map-board-label">User insights</h3>
      ${renderResearchList(variantData.insights, 'No user insights yet.')}
    `;
  }

  if (nextSteps) {
    nextSteps.innerHTML = `
      <h3 class="map-board-label">What to try next</h3>
      ${renderResearchList(variantData.nextSteps, 'No follow-up ideas yet.')}
    `;
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
