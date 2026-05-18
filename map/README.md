# Journey Map Area

The `/map` directory is designed to be portable. You should be able to copy this whole folder into another NHS prototype and keep the content model, build logic, assets, and route logic together.

It gives us 3 levels:

1. `index.html` for the user journeys overview
2. `journeys/<journey>/index.html` for the latest journey version
3. `journeys/<journey>/steps/<step>/index.html` for the latest step detail

It also generates version-specific pages:

1. `journeys/<journey>/versions/<version>/index.html`
2. `journeys/<journey>/versions/<version>/steps/<step>/index.html`

## Content structure

Journey data lives under:

```text
map/
  versions.yaml
  journeys/
    [journey-slug]/
      journey.v1.yaml
      journey.v2.yaml
      [step-slug]/
        step.yaml
        screenshots/
```

There is no separate `user-insights` data source anymore. Each `journey.vX.yaml` file carries both:

- the structure of that version of the journey
- the insights and next steps for that version

Shared metadata for each version lives in `map/versions.yaml`.

## What lives in this folder

- `build.js`: builds the static `/map/dist` site from YAML
- `router.js`: Express router that serves `/map` and rebuilds automatically if the source files change
- `journeys/`: versioned journey YAML plus step YAML and screenshots
- `versions.yaml`: shared metadata for version ids such as labels and tags
- `assets/`: CSS and JavaScript for the generated pages

## Minimal integration in a prototype

1. Copy the whole `/map` folder into the root of the prototype.
2. Install `js-yaml` and `nunjucks` in that prototype if they are not already available:

```bash
npm install js-yaml nunjucks
```

3. Mount the router from `app/routes.js`:

```js
router.use('/', require('../map/router'));
```

That is the only required wiring. The router will generate `map/dist` automatically the first time `/map` is requested, and it will rebuild when files inside `/map` change.

## Optional manual build

If you want to build the map without starting the prototype:

```bash
node map/build.js
```

That writes the generated site to `map/dist`.

If you want rebuilds while editing the map files:

```bash
npm run map:watch
```

That watches the map journey data, templates, assets, and build files, but not `map/dist`, so it does not loop on its own generated output.

## YAML shape

`versions.yaml`

```yaml
versions:
  v1:
    label: Round 1 testing

  v2:
    label: Round 2 testing
    tag: Latest
```

`journey.v1.yaml`

```yaml
id: v1
tag: Latest

title: Journey title
summary: Optional short explanation of what this version covers
service: Optional service name
owner: Optional owner or team

step_order:
  - first-step
  - second-step

journey_findings:
  insights:
    - Journey-level learning for this version
  next_steps:
    - Optional journey-level next step

findings:
  - scope: step
    step: first-step
    insights:
      - Applies to the whole step in this version
    next_steps:
      - Follow-up idea

  - scope: variant
    step: second-step
    variant: default
    insights:
      - Applies only to one variant in this version

  - scope: cross-step
    steps:
      - first-step
      - second-step
    insights:
      - One finding that spans several steps

  - scope: dependency
    step: second-step
    related_steps:
      - first-step
    insights:
      - A finding where one step affected another
```

`step.yaml`

```yaml
title: Step title

versions:
  v1:
    summary: Short summary for this version of the step
    prototype_path: /optional/prototype/path
    nav_path:
      - Top-level item
      - Optional sub-navigation item
    focus_questions:
      - Optional research question
    default_variant: default
    variants:
      - id: default
        label: Default view
        screenshot: screenshots/default.png
        alt: Optional accessible alt text
        caption: Optional caption shown below the screenshot

  v2:
    summary: Updated summary for this version of the step
    default_variant: alternative
    variants:
      - id: alternative
        label: Updated view
        screenshot: screenshots/alternative.png

  v3:
    use: v2
```

If `alt` is omitted, the builder generates a fallback alt from the step title and variant label.

If `caption` is omitted, no caption is shown.

## Rules

- Each journey must define at least one `journey.vX.yaml`.
- `versions.yaml` must define metadata for every version id used by any `journey.vX.yaml`.
- Each `journey.vX.yaml` must list its `step_order`.
- `tag` is optional on `journey.vX.yaml` and can be used to mark the latest version for that specific journey.
- Every step listed in that `step_order` must either have a matching `versions.vX` block in its `step.yaml`, or an earlier `versions.vY` block that can be reused automatically.
- If there is no exact `versions.vX`, the builder falls back to the nearest earlier step version.
- A `versions.vX` block can still be a pure alias like `use: v1` when you want to make the reuse explicit.
- Alias blocks are strict: if you use `use`, it must be the only field in that version block.
- The latest journey page at `/map/journeys/<journey>/` is resolved from the version tagged `Latest`, or the highest `vX` if no tag is present.
- Cross-step and dependency findings are shown on step detail pages as connected findings.

## Runtime modes

The router supports 2 modes:

- `MAP_BUILD_MODE=runtime`
  Opt-in development mode. `/map` rebuilds on request when the source files change.
- `MAP_BUILD_MODE=static`
  The default. The router serves only the prebuilt `map/dist` output and will fail clearly if `map/dist/index.html` is missing.

For remote environments, the recommended setup is:

1. Run `npm run map:build` during deploy or startup.
2. Serve the prebuilt output with `MAP_BUILD_MODE=static`.

For local development in this repo, `.env` currently sets:

```text
MAP_BUILD_MODE=runtime
```

If you want local `/map` to behave like a remote server, remove that line or set it to `static`.

## Notes

- `map/dist` is generated output and can be ignored in git.
- The generated pages assume the host prototype already serves the standard NHS frontend CSS at `/css/main.css`.
- If you want to prebuild the map during startup in a specific prototype, you can still add your own `prestart` script there, but the folder does not depend on it.
