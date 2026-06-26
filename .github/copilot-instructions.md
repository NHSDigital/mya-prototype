# Copilot instructions

This repo has a single source of truth for how to work on it: **`AGENTS.md`** in the repo root.
Read it before making changes, and follow it.

Key points (full detail in `AGENTS.md`):

- Journeys live in `app/journeys/v1/<journey>/` with co-located `routes.js`, `.html` views,
  `map.json`, `insights.md`, `implementation.md`. Each version is served under `/vN`.
- **GET handlers must be idempotent** (render from session data alone) and **render with
  version-agnostic names** (`res.render('clinics/clinics')`, not `'v1/...'`).
- **Keep content in views, logic in routes/helpers.** Use the approved components listed in
  `AGENTS.md` section 5; extend `layout.html`; import with rooted names.
- Prefer the deterministic scripts: `npm run journey:new`, `npm run map:validate`,
  `npm run map:screenshots`. A human must always be able to edit everything by hand.
- The `/map` documentation site and `app/map/templates`/`assets` are a shared design — don't
  restyle them.

Slash-command prompts in `.github/prompts/` cover the common tasks; each defers to `AGENTS.md`.
