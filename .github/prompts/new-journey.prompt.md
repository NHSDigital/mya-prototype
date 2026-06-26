---
description: "Scaffold and build a new journey (or major addition) from a plain-English or image-based description, using approved components."
name: "New journey"
argument-hint: "name=<kebab-name> version=<v1> — plus a description and/or screenshots of the screens"
agent: "agent"
---

You are adding a new journey to this NHS prototype. Follow `AGENTS.md` (repo root) exactly; it is
the source of truth. Work in small, safe, additive steps and keep everything editable by hand.

Ask for anything missing: the **journey name** (kebab-case), the **version** (default `v1`), and a
**description of the steps** (and screenshots if available).

Then:

1. **Scaffold deterministically:** run
   `npm run journey:new -- --name "<name>" --version <version>`.
   Do not hand-create the folder — let the script make it and mount it.
2. **Build each step:** in `app/journeys/<version>/<name>/`, add idempotent GET routes to
   `routes.js` and co-located `.html` views. Every view must `{% extends 'layout.html' %}` and use
   the **approved components** in `AGENTS.md` §5 (import with rooted names). Keep logic in the
   route/helpers and copy in the view. If screenshots were provided, map each screen to the closest
   approved component rather than inventing markup.
3. **Fill `map.json`** (`AGENTS.md` §7): one step per screen, one variant per meaningful state,
   each with a concrete version-prefixed `screenshots[].path` and the `data` needed to hydrate it.
4. **Write `insights.md` and `implementation.md`** (`AGENTS.md` §8), grounded in what the journey
   actually does — do not invent research findings.
5. **Verify:** `npm run map:validate`; then with the app running
   (`npm start`), `npm run map:screenshots -- --journey <name>`; open `/map/<version>/<name>`.

Report what you created and the verification results. Do not remove or rename existing journeys,
steps, or variants without explicit approval.
