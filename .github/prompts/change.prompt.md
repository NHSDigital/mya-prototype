---
agent: agent
description: Plan or implement a tightly scoped map-driven prototype change
---

You are helping implement a research-driven change in this NHS prototype.

Project context:
- The source of truth for research changes is the `/map` system.
- Read [map/README.md](../../map/README.md) for the structure.
- Shared version metadata lives in [map/versions.yaml](../../map/versions.yaml).
- Journey files live under [map/journeys](../../map/journeys/).

Inputs:
- Journey: ${input:journey:Which journey? For example: navigation, change-clinic-series, change-single-clinic}
- Version: ${input:version:Which version? For example: v1 or v2}
- Scope: ${input:scope:Scope? Enter "step" or "journey"}
- Step: ${input:step:If scope is step, which step slug? Leave blank if scope is journey}
- Mode: ${input:mode:Mode? Enter "plan" or "implement"}

Start by doing this:
1. Restate the selected journey, version, scope, step, and mode.
2. Read the relevant `/map` files for that journey and version.
3. If scope is `step`, use only the next steps relevant to that step.
4. If scope is `journey`, use only the next steps for that journey/version.
5. List the exact next step items you believe are in scope.

Rules:
- Do not use next steps from any other journey.
- Do not use next steps from any other version.
- Do not infer new next steps.
- Do not bundle unrelated changes together.
- Prefer the smallest reviewable diff.
- Do not refactor unrelated code.
- If the work would touch more than 5 files, stop and propose splitting it.
- If scope is `journey`, only group changes that are clearly part of the same UI/content change.
- If the requested scope is too broad to review safely, say so and recommend narrowing it.
- If `scope` is `step` and `step` is blank, ask for the missing step before continuing.

When reading the map:
- Use the selected `journey.vX.yaml` file as the source for findings and next steps.
- Use step `step.yaml` files to understand the relevant screens, variants, and notes.
- Treat the latest rendered screenshots and variant labels as context, not as permission to change unrelated parts of the journey.

If mode is `plan`:
- Return:
  1. Selected journey/version/scope
  2. Exact next steps in scope
  3. Prototype pages or routes affected
  4. Likely files to change
  5. A small implementation plan
  6. Risks, assumptions, or blockers
- Stop there.

If mode is `implement`:
- First restate:
  1. Selected journey/version/scope
  2. Exact next steps in scope
  3. Files you expect to touch
- Then implement only that scope.
- Keep the diff tight and easy to review.
- Finish with a short summary of what changed.

Important:
- The goal is not to "do all the latest round changes".
- The goal is to produce one understandable, reviewable change at a time.
