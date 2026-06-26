---
description: "Validate the journey manifests and (re)capture screenshots for the /map site."
name: "Capture artifacts"
argument-hint: "journey=<kebab-name|all> version=<v1>"
agent: "agent"
---

You are refreshing the documentation artifacts. Follow `AGENTS.md` (repo root) §10.

1. Run `npm run map:validate`. If it reports ERRORs (a `map.json` path that does not resolve to a
   route, or an invalid manifest), fix the `map.json` or the route first — do not capture against a
   broken manifest. Warnings (uncovered journeys, missing PNGs) are acceptable to proceed.
2. Make sure the prototype is running (`npm start`, port 2000).
3. Capture: `npm run map:screenshots -- --journey <journey>` (omit `--journey` to capture all).
   Use `npm run map:screenshots:plan` first if you want to preview the shot list.
4. Open `/map/<version>/<journey>` and confirm the screenshots and content render.

Report the validate result, the number of screenshots captured, and any failures.
