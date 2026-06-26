---
description: "Safely modify an existing journey — add or change a step/variant, update content, keep map.json in sync."
name: "Update journey"
argument-hint: "journey=<kebab-name> version=<v1> — plus what to change"
agent: "agent"
---

You are updating an existing journey. Follow `AGENTS.md` (repo root). Make **additive, safe**
changes; do not remove or rename steps/variants without explicit approval.

Confirm the **journey** and **version**, and exactly what should change.

Then:

1. Read the journey folder `app/journeys/<version>/<journey>/` (routes.js, views, map.json,
   insights.md, implementation.md) so you understand the current state.
2. Make the change following the golden rules in `AGENTS.md` §2: idempotent GETs, content in views,
   logic in routes/helpers, version-agnostic render names, approved components.
3. If you added or changed a screen/state, **update `map.json`** (§7) — add the step/variant with a
   concrete `screenshots[].path` and the `data` to hydrate it — and update `insights.md` /
   `implementation.md` if the rationale or behaviour changed.
4. **Verify:** `npm run map:validate`; then with the app running,
   `npm run map:screenshots -- --journey <journey>`; check `/map/<version>/<journey>`.

Report the diff and verification results.
