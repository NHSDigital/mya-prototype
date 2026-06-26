import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs'

const pageConfigElement = document.getElementById('map-generated-page-config')
let pageConfig = window.__MAP_GENERATED_PAGE__ || {}

if (pageConfigElement && pageConfigElement.textContent) {
  try {
    pageConfig = JSON.parse(pageConfigElement.textContent)
  } catch {
    pageConfig = window.__MAP_GENERATED_PAGE__ || {}
  }
}

const hasMermaidSource = typeof pageConfig.mermaidSource === 'string' && pageConfig.mermaidSource.length > 0
const deepLinkParams = new URLSearchParams(window.location.search)

let mapRendered = false
let focusCleanupTimer = null
let mapInteractionReady = false

if (hasMermaidSource) {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    flowchart: {
      curve: 'linear',
      nodeSpacing: 36,
      rankSpacing: 80,
      htmlLabels: true
    }
  })
}

function createMapControlButton(label, title, onClick) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'map-generated-control-btn'
  button.textContent = label
  button.setAttribute('aria-label', title)
  button.title = title
  button.addEventListener('click', onClick)
  return button
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function setupMapInteractions(mapElement) {
  if (mapInteractionReady) return

  const svg = mapElement.querySelector('svg')
  const graphLayer = svg && svg.querySelector('g')
  if (!svg || !graphLayer) return

  const bounds = graphLayer.getBBox()
  if (!Number.isFinite(bounds.width) || !Number.isFinite(bounds.height) || bounds.width <= 0 || bounds.height <= 0) {
    return
  }

  const padding = 80
  const fitViewBox = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: Math.max(1, bounds.width + (padding * 2)),
    height: Math.max(1, bounds.height + (padding * 2))
  }

  const viewBox = {
    ...fitViewBox
  }

  const minWidth = fitViewBox.width * 0.25
  const maxWidth = fitViewBox.width * 8
  const minHeight = fitViewBox.height * 0.25
  const maxHeight = fitViewBox.height * 8
  const panRangeX = fitViewBox.width
  const panRangeY = fitViewBox.height
  const zoomFactor = 1.2

  svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`)
  svg.style.touchAction = 'none'

  function applyViewBox() {
    viewBox.width = clamp(viewBox.width, minWidth, maxWidth)
    viewBox.height = clamp(viewBox.height, minHeight, maxHeight)
    viewBox.x = clamp(viewBox.x, fitViewBox.x - panRangeX, fitViewBox.x + panRangeX)
    viewBox.y = clamp(viewBox.y, fitViewBox.y - panRangeY, fitViewBox.y + panRangeY)
    svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`)
  }

  function clientPointToViewBox(clientX, clientY) {
    const rect = svg.getBoundingClientRect()
    const relativeX = (clientX - rect.left) / rect.width
    const relativeY = (clientY - rect.top) / rect.height
    return {
      x: viewBox.x + (relativeX * viewBox.width),
      y: viewBox.y + (relativeY * viewBox.height)
    }
  }

  function zoomAt(factor, centerX, centerY) {
    const nextWidth = clamp(viewBox.width / factor, minWidth, maxWidth)
    const nextHeight = clamp(viewBox.height / factor, minHeight, maxHeight)
    const widthScale = nextWidth / viewBox.width
    const heightScale = nextHeight / viewBox.height

    viewBox.x = centerX - ((centerX - viewBox.x) * widthScale)
    viewBox.y = centerY - ((centerY - viewBox.y) * heightScale)
    viewBox.width = nextWidth
    viewBox.height = nextHeight
    applyViewBox()
  }

  function zoomAtCenter(factor) {
    const centerX = viewBox.x + (viewBox.width / 2)
    const centerY = viewBox.y + (viewBox.height / 2)
    zoomAt(factor, centerX, centerY)
  }

  function panByPixels(deltaX, deltaY) {
    const rect = svg.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    viewBox.x -= deltaX * (viewBox.width / rect.width)
    viewBox.y -= deltaY * (viewBox.height / rect.height)
    applyViewBox()
  }

  function fitToGraph() {
    viewBox.x = fitViewBox.x
    viewBox.y = fitViewBox.y
    viewBox.width = fitViewBox.width
    viewBox.height = fitViewBox.height
    applyViewBox()
  }

  function resetToDefaultZoom() {
    const defaultScale = 2
    viewBox.width = fitViewBox.width / defaultScale
    viewBox.height = fitViewBox.height / defaultScale
    viewBox.x = fitViewBox.x + ((fitViewBox.width - viewBox.width) / 2)
    viewBox.y = fitViewBox.y + ((fitViewBox.height - viewBox.height) / 2)
    applyViewBox()
  }

  const controls = document.createElement('div')
  controls.className = 'map-generated-controls'
  controls.appendChild(createMapControlButton('+', 'Zoom in', () => zoomAtCenter(zoomFactor)))
  controls.appendChild(createMapControlButton('−', 'Zoom out', () => zoomAtCenter(1 / zoomFactor)))
  controls.appendChild(createMapControlButton('Fit', 'Fit graph to view', () => fitToGraph()))
  controls.appendChild(createMapControlButton('Reset', 'Reset zoom level', () => resetToDefaultZoom()))

  const hint = document.createElement('p')
  hint.className = 'map-generated-controls-hint'
  hint.textContent = 'Scroll to zoom, drag to pan.'

  const wrapper = document.createElement('div')
  wrapper.className = 'map-generated-controls-wrap'
  wrapper.appendChild(controls)
  wrapper.appendChild(hint)
  mapElement.insertAdjacentElement('beforebegin', wrapper)

  mapElement.classList.add('map-generated-mermaid--interactive')
  mapElement.setAttribute('tabindex', '0')

  let pointerActive = false
  let activePointerId = null
  let lastX = 0
  let lastY = 0

  svg.addEventListener('wheel', (event) => {
    event.preventDefault()
    const point = clientPointToViewBox(event.clientX, event.clientY)
    const factor = event.deltaY < 0 ? zoomFactor : (1 / zoomFactor)
    zoomAt(factor, point.x, point.y)
  }, { passive: false })

  svg.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return
    pointerActive = true
    activePointerId = event.pointerId
    lastX = event.clientX
    lastY = event.clientY
    svg.setPointerCapture(event.pointerId)
    mapElement.classList.add('is-panning')
  })

  svg.addEventListener('pointermove', (event) => {
    if (!pointerActive || event.pointerId !== activePointerId) return
    const deltaX = event.clientX - lastX
    const deltaY = event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    panByPixels(deltaX, deltaY)
  })

  function stopPanning(event) {
    if (!pointerActive || event.pointerId !== activePointerId) return
    pointerActive = false
    activePointerId = null
    mapElement.classList.remove('is-panning')
  }

  svg.addEventListener('pointerup', stopPanning)
  svg.addEventListener('pointercancel', stopPanning)
  svg.addEventListener('pointerleave', stopPanning)

  mapElement.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomAtCenter(zoomFactor)
      return
    }

    if (event.key === '-') {
      event.preventDefault()
      zoomAtCenter(1 / zoomFactor)
      return
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault()
      fitToGraph()
      return
    }

    if (event.key === '0') {
      event.preventDefault()
      resetToDefaultZoom()
    }
  })

  mapInteractionReady = true
}

async function ensureMapRendered() {
  if (!hasMermaidSource || mapRendered) return

  const mapElement = document.querySelector('[data-map-generated-mermaid]')
  if (!mapElement) return

  mapElement.textContent = pageConfig.mermaidSource
  await mermaid.run({ nodes: [mapElement] })
  setupMapInteractions(mapElement)
  mapRendered = true
}

async function setView(nextView) {
  const viewPanels = Array.from(document.querySelectorAll('[data-site-view-panel]'))
  const viewSelect = document.querySelector('[data-site-view-select]')
  const viewLinks = Array.from(document.querySelectorAll('[data-site-view-link]'))

  if (!viewPanels.length) return

  const availableViews = viewPanels.map((panel) => panel.dataset.siteViewPanel)
  const selectedView = availableViews.includes(nextView) ? nextView : availableViews[0]

  if (viewSelect) {
    viewSelect.value = selectedView
  }

  for (const link of viewLinks) {
    const isActive = link.dataset.siteView === selectedView
    link.classList.toggle('map-site-view-nav__link--active', isActive)
    link.setAttribute('aria-current', isActive ? 'page' : 'false')
  }

  for (const panel of viewPanels) {
    const isMatch = panel.dataset.siteViewPanel === selectedView
    panel.hidden = !isMatch
  }

  if (selectedView === 'map' || selectedView === 'mermaid') {
    await ensureMapRendered()
  }
}

function getHashView(availableViews) {
  const hash = String(window.location.hash || '').replace(/^#/, '').trim().toLowerCase()
  if (!hash) return ''
  return availableViews.includes(hash) ? hash : ''
}

function setHashView(nextView) {
  if (!nextView) return
  if (window.location.hash === `#${nextView}`) return

  if (window.history && typeof window.history.replaceState === 'function') {
    const nextUrl = `${window.location.pathname}${window.location.search}#${nextView}`
    window.history.replaceState(null, '', nextUrl)
    return
  }

  window.location.hash = nextView
}

function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getPathDeepLink() {
  const parts = window.location.pathname
    .split('/')
    .filter(Boolean)
    .map((part) => normalizeSlug(part))

  if (parts[0] !== 'map') {
    return { step: '', variant: '' }
  }

  const step = parts.length >= 4 ? parts[3] : ''
  const variant = parts.length >= 5 ? parts[4] : ''

  return { step, variant }
}

function findDeepLinkTarget() {
  const pathDeepLink = getPathDeepLink()
  const step = normalizeSlug(deepLinkParams.get('step') || pathDeepLink.step)
  const variant = normalizeSlug(deepLinkParams.get('variant') || pathDeepLink.variant)

  if (step && variant) {
    const variantTarget = document.getElementById(`variant-${step}-${variant}`)
    if (variantTarget) return variantTarget
  }

  if (step) {
    const stepTarget = document.getElementById(`step-${step}`)
    if (stepTarget) return stepTarget
  }

  return null
}

function focusDeepLinkTarget() {
  const target = findDeepLinkTarget()
  if (!target) return

  target.classList.add('map-deep-link-focus')
  target.scrollIntoView({ block: 'start', behavior: 'smooth' })

  if (focusCleanupTimer) {
    window.clearTimeout(focusCleanupTimer)
  }

  focusCleanupTimer = window.setTimeout(() => {
    target.classList.remove('map-deep-link-focus')
  }, 2200)
}

const viewSelect = document.querySelector('[data-site-view-select]')
const viewPanels = Array.from(document.querySelectorAll('[data-site-view-panel]'))
const viewLinks = Array.from(document.querySelectorAll('[data-site-view-link]'))

if (viewPanels.length) {
  const availableViews = viewPanels.map((panel) => panel.dataset.siteViewPanel)

  if (viewSelect) {
  viewSelect.addEventListener('change', async (event) => {
      const selectedView = event.target.value
      await setView(selectedView)
      setHashView(selectedView)
  })
  }

  for (const link of viewLinks) {
    link.addEventListener('click', async (event) => {
      event.preventDefault()
      const selectedView = link.dataset.siteView
      await setView(selectedView)
      setHashView(selectedView)
    })
  }

  const initialView = pageConfig.initialView || (viewSelect ? viewSelect.value : '') || availableViews[0]
  const hashView = getHashView(availableViews)
  const pathDeepLink = getPathDeepLink()
  const shouldDeepLink =
    deepLinkParams.has('step')
    || deepLinkParams.has('variant')
    || Boolean(pathDeepLink.step)
  const deepLinkFallbackView = availableViews.includes('screenshots')
    ? 'screenshots'
    : availableViews.includes('board')
      ? 'board'
      : availableViews[0]
  const targetView = hashView || (shouldDeepLink ? deepLinkFallbackView : initialView)

  setView(targetView).then(() => {
    if (!hashView && (targetView === 'mermaid' || targetView === 'map' || targetView === 'board' || targetView === 'screenshots')) {
      setHashView(targetView)
    }
    if (shouldDeepLink) {
      focusDeepLinkTarget()
    }
  })

  window.addEventListener('hashchange', () => {
    const nextHashView = getHashView(availableViews)
    if (nextHashView) {
      setView(nextHashView)
    }
  })
}
