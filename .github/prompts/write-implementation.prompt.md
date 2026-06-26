---
description: "Generate per-journey implementation.md (user stories + acceptance criteria) from the journey's behaviour."
name: "Write implementation"
argument-hint: "journey=<kebab-name> version=<v1>"
agent: "agent"
---

You are writing journey **implementation docs** (user stories + acceptance criteria). Follow
`AGENTS.md` (repo root) §8.

1. Confirm the **journey** and **version**.
2. Read the journey's `routes.js`, views and `map.json` so the doc reflects what the journey
   **actually does** (steps, variants, validation/error states).
3. Write/update `app/journeys/<version>/<journey>/implementation.md`:
   - A `## User story` ("As a … I want to … So that …").
   - `## Acceptance criteria` as Given/When/Then bullets, with a sub-heading per scenario. Cover
     the meaningful variants in `map.json` (default, validation/error, empty, keep/cancel, etc.).
   - Optionally `## step: <step-id>` sections to attach criteria to specific steps.
4. Ground every criterion in real behaviour — **do not invent** requirements. Merge with any
   existing content rather than overwriting.
5. Open `/map/<version>/<journey>` and confirm the Implementation tab renders.

List the file changed and summarise the acceptance criteria you added.
