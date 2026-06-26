# AGENTS.md — how to work on this prototype

This file is the **single source of truth** for any LLM (GitHub Copilot, Claude, Cursor,
…) or human working on this repo. It is written as plain, ordered steps so that **lower-cost
models** can follow it reliably. GitHub Copilot prompt commands live in `.github/prompts/` and
all defer to this file.

**Golden rule:** prefer the deterministic scripts (`npm run journey:new`, `map:validate`,
`map:screenshots`). Use the LLM to fill in content and wiring the scripts can't. A human must
always be able to edit every file by hand.

---

## 1. What this is & how to run it

An NHS prototype (Express + Nunjucks, via `nhsuk-prototype-kit`) for "Manage Your Appointments".

- Start: `npm start` (serves on http://localhost:2000).
- The app is organised into **versioned journeys** served under a version prefix, e.g.
  `/v1/site/1/clinics`. Unversioned URLs (`/sites`, `/site/...`) redirect to the default version.
- A live documentation site lives at **`/map`** (overview → journey board → step detail).

## 2. Golden rules (read before editing)

1. **GET handlers must be idempotent.** A page must render correctly from `req.session.data`
   alone, on a plain GET, with no prior POST. This is what makes a page screenshot-able from a
   `map.json` variant. POST handlers only mutate state then redirect to a GET.
2. **Content lives in views, logic in routes/helpers.** Keep `.html` views as markup + copy.
   Do calculations in the route or in `app/journeys/<version>/_shared/helpers.js`, then pass
   finished values to `res.render`.
3. **Render with version-agnostic names.** In a journey route write
   `res.render('clinics/clinics')`, never `'v1/clinics/clinics'`. The version middleware
   (`app/journeys/version-middleware.js`) prepends the version and prefixes URLs/links.
4. **Use approved components** (section 5). Don't hand-roll markup that a component already
   provides. Extend the shared layout with `{% extends 'layout.html' %}` and import components by
   **rooted** names, e.g. `{% from 'components/app-card.njk' import appCard %}` — never relative
   `../../` paths.
5. **Keep `map.json` in sync** with the routes/views (run `npm run map:validate`).

## 3. Project map

```
app/
  app.js                      kit init + nunjucks viewsPath
  routes.js                   global middleware -> /map -> journeys
  middleware/screenshot-data.js   hydrates session from x-journey-screenshot-data header
  views/                      SHARED chrome (NOT versioned): layouts/, components/, includes/
  journeys/
    index.js                  mounts each version under /vN via versionMiddleware
    version-middleware.js      prepends version to render names + URLs/links
    v1/
      index.js                registers site-context, mounts each journey
      _shared/                site-context.js (per-site data), helpers.js (clinic logic)
      _legacy/                deprecated redirects
      <journey>/              ONE folder per journey:
        routes.js             co-located route file
        *.html                co-located views (single/, series/ subfolders where needed)
        map.json              journey map manifest (steps/variants/hydration)  [section 7]
        insights.md           why we made changes (rendered in /map)            [section 8]
        implementation.md     user stories + acceptance criteria (in /map)      [section 8]
  map/
    routes.js                 the live /map site (Express + Nunjucks)
    templates/ assets/        ported map-site-template (do not restyle)
    lib/                      manifest loader, view-model builder, markdown
    map.schema.json           JSON Schema for map.json
    screenshots/              captured PNGs (committed so /map works on a fresh clone)
scripts/
  journey-new.js              scaffold a journey            (npm run journey:new)
  map-validate.js             validate manifests vs routes  (npm run map:validate)
  map-screenshots.js          capture variant PNGs          (npm run map:screenshots)
```

## 4. Adding or editing a journey (step by step)

1. **Scaffold:** `npm run journey:new -- --name "<kebab-name>" --version v1`. This creates the
   folder (routes.js, start.html, map.json, insights.md, implementation.md) and mounts it.
2. **Build the steps.** Add routes to `routes.js` (idempotent GETs) and co-located `.html` views
   that `{% extends 'layout.html' %}` and use approved components (section 5). Match the existing
   journeys' style. Keep URLs under `/site/:id/<name>/...`.
3. **Update `map.json`** (section 7): one entry per step, one variant per meaningful screen state,
   with concrete version-prefixed `screenshots[].path` and any `data` needed to hydrate that state.
4. **Write `insights.md` and `implementation.md`** (section 8) — or use the
   `/write-insights` and `/write-implementation` prompts.
5. **Verify:** `npm run map:validate`, then `npm start` and `npm run map:screenshots -- --journey
   <name>`, then open `/map/v1/<name>`.

To **add a new version**: `cp -r app/journeys/v1 app/journeys/v2`, then add one line to
`app/journeys/index.js`: `router.use('/v2', versionMiddleware('v2'), require('./v2'));`.

## 5. Approved component catalog

Import with rooted names. Use these instead of bespoke markup.

| Component | Import | Use for |
|---|---|---|
| `appCard(params)` | `'components/app-card.njk'` | A titled card with a key/value `summaryList` and an optional "Change" action. `params`: `title`, `action: { href, text, visuallyHiddenText }`, `items: [{ key, value }]` **or** `html`, `classes`, `attributes`. |
| `appActionControlBar(params)` | `'components/action-control-bar.njk'` | The "Create clinics / Cancel all clinics" action bar. `params`: `siteId`, `create`, `print`, `createClinicHref`, `cancelDateRangeHref`. |
| `appSecondaryNavigation(params)` | `'components/secondary-navigation.njk'` | Day/Week/Month style sub-nav. `params`: `items: [{ text, href, primary, current }]`, `visuallyHiddenTitle`. |
| `appointmentsSummary(params)` | `'components/appointments-summary.njk'` | A stat strip. `params`: `items: [{ figure, label }]`, `ariaLive`, `classes`. |
| `renderServicesTable(opts)` | `'includes/renderServicesTable.njk'` | Time / Services / Booked / Unbooked / Actions table for a day's sessions. `opts`: `slots`, `date`, `data`, `site_id`, `sessions`, `change`. |

Plus standard NHS macros are available (e.g. `nhsuk/components/{button,date-input,radios,checkboxes,summary-list,card,tabs,pagination}/macro.njk`).

## 6. Custom Nunjucks filters

Dates/times: `formatDate`, `formatTime`, `nhsDate`, `nhsTime`, `nhsDateRange`, `dayName`,
`monthName`, `iso`, `daysAgo`, `daysAhead`, `isDateInPast`, `isDateBetween`, `isTimeBetween`,
`extractTimePart`.
Other: `nhsNumber`, `plural`, `padZero`, `formatNumber`, `shortWeekdays`, `splitString`,
`splitCamelCase`, `toJson`, `prettyDump`, `randomNumber`.

## 7. `map.json` (one per journey)

Lives at `app/journeys/<version>/<journey>/map.json`. The journey `id` and `version` are
**inferred from the folder path** — do not put them in the file. Schema: `app/map/map.schema.json`.

```json
{
  "$schema": "../../../map/map.schema.json",
  "title": "Cancel a date range",
  "summary": "Cancel every clinic in a chosen date range.",
  "section": "Manage availability",
  "status": "ready for dev",
  "steps": [
    {
      "id": "check-answers",
      "title": "Check answers",
      "defaultVariant": "keep-bookings",
      "variants": [
        { "id": "keep-bookings", "label": "Keep bookings",
          "screenshots": [
            { "label": "Keep", "path": "/v1/site/1/cancel-availability/check-answers",
              "data": { "cancelAvailability": { "keepOrCancelBookings": "keep" } } }
          ] }
      ]
    }
  ]
}
```

Rules:
- `screenshots[].path` is a **concrete, version-prefixed** route (no `:params`). It must be a
  GET-renderable page (idempotent).
- `screenshots[].data` is **deep-merged into `req.session.data`** before the page renders (by
  `app/middleware/screenshot-data.js`). Use it to set the exact state a variant needs (dates,
  closures, bookings, `newSession.type`, etc.). Special keys: `today` (date override), `features`
  (feature flags).
- The primary screenshot of a variant is the image shown in `/map` (file `=<variant id>.png`).

## 8. `insights.md` and `implementation.md`

Both live in the journey folder and are rendered (via `markdown-it`) into the `/map` site.
- `insights.md` — a short blog-style write-up of **why** changes were made; shown on the step
  pages' "User insights" tab.
- `implementation.md` — **user stories + acceptance criteria**; shown on the "Implementation" tab.
  Use `## User story` and `## Acceptance criteria` with Given/When/Then bullets.
- Optional: a heading `## step: <step-id>` splits a doc so a step page shows only its slice
  (intro + that section).

## 9. The `/map` site

Live Express + Nunjucks; **no build step** — edit `map.json` / `.md` and refresh.
- `/map` overview (cards grouped by `section`)
- `/map/:version/:journey` board (steps across, variant switcher, screenshots)
- `/map/:version/:journey/:step[/:variant]` step detail (screenshot / insights / implementation)

Do **not** restyle the templates/markup in `app/map/templates` or `app/map/assets` — they are a
shared design and reused verbatim.

## 10. Commands

| Command | Does |
|---|---|
| `npm start` | Run the prototype (port 2000). |
| `npm run journey:new -- --name x --version v1` | Scaffold a journey. |
| `npm run map:validate` | Validate manifests; check paths resolve to routes; warn on uncovered journeys / missing PNGs. |
| `npm run map:screenshots -- --journey x` | Capture PNGs (prototype must be running). |
| `npm run map:screenshots:plan` | Dry-run: list the shots that would be captured. |

## 11. Task recipes (for the prompt commands)

- **New journey from a description/images:** scaffold (`journey:new`), then build steps with
  approved components, fill `map.json` + the two `.md` files, validate, screenshot. If images are
  provided, map each screen to the closest approved component; a vision-capable model is needed to
  read images, but the scaffold + catalog work without one.
- **Add a variant:** add a `variant` (with `screenshots[].path` + `data`) to the right step in
  `map.json`; ensure the GET renders that state from the `data`; validate; screenshot.
- **Write insights:** take the user's raw notes and update the relevant journey's `insights.md`
  (and only those) — keep it short and decision-focused; never invent findings.
- **Write implementation:** produce `implementation.md` with a clear user story and Given/When/Then
  acceptance criteria grounded in what the routes/views actually do.
