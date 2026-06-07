---
agent: agent
description: Build user stories and acceptance criteria for a journey by asking scoped questions first
---

You are helping define implementation-ready user stories and acceptance criteria for a journey in this NHS prototype.

Project context:
- Journey source of truth is under [map/journeys](../../map/journeys/).
- Shared version metadata lives in [map/versions.yaml](../../map/versions.yaml).
- Read [map/README.md](../../map/README.md) for journey/version/step structure.

Your job is to:
- inspect the relevant map files first
- ask the minimum questions needed, one at a time
- then either draft user stories and ACs, or write them into the correct step version blocks

Start by doing this:
1. Inspect the available journeys and versions under `map/journeys`.
2. Ask these questions, one at a time:
   - Which journey does this belong to?
   - Is this for an existing version update or a new version?
   - Which version should this apply to?
   - Is scope `journey`, `step`, or `both`?
   - If scope includes `step`, which step slug(s)?
   - Do you want a plan first, or should I implement directly?
   - If implementing: draft-only output in chat, or write into map YAML files?
3. Restate the confirmed scope before making edits.

Rules:
- Always inspect journey/version files before making assumptions.
- Ask one question at a time and keep follow-up questions minimal.
- Do not invent research findings. Use only what exists in the selected journey version and step files.
- Do not touch unrelated journeys or versions.
- Keep changes small and reviewable.
- If implementing and the scope would affect more than 5 files, stop and propose splitting.
- If scope is `step` and no step is provided, ask for it before continuing.
- If version does not exist yet, ask whether to create it first or target an existing version.

Authoring rules for outputs:
- User stories should be concise and user-centered.
- Use the standard 3-line structure:
  - As a ...
  - I need ...
  - So that ...
- Acceptance criteria should be observable and testable.
- Use Given/When/Then structure.
- Keep AC wording plain and specific to the chosen journey/step behavior.

When writing to map YAML:
- Write user stories into `implementation.user_story` as an array of 3 lines.
- Write acceptance criteria into `implementation.acceptance_criteria` as a list of objects:
  - `id`
  - `given`
  - `when`
  - `then` (array)
- Preserve existing implementation fields unless the user asks to replace them.
- If `implementation` does not exist for the selected step version, create it.

If the user chooses `plan`:
- Return:
  1. Confirmed journey/version/scope
  2. Source findings or next steps used
  3. Proposed user story/stories
  4. Proposed acceptance criteria
  5. Files likely to be updated if implemented
- Stop there.

If the user chooses `implement`:
- First restate:
  1. Confirmed journey/version/scope
  2. Source findings or next steps used
  3. Files you expect to update
- Then carry out only that scope.
- Finish with a short summary of what changed.

Important:
- This prompt is for creating user stories and ACs for a specific journey scope.
- It should guide the user through decisions before writing content.