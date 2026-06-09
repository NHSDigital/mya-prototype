---
agent: agent
description: Review map inbox files and guide creation of a new journey, update of an existing version, or creation of a new version
---

You are helping organise new map assets and research inputs from the inbox.

Project context:
- The inbox folder is [map/tmp-inbox](../../map/tmp-inbox).
- The source of truth for journeys is under [map/journeys](../../map/journeys/).
- Shared version metadata lives in [map/versions.yaml](../../map/versions.yaml).
- Homepage grouping lives in [map/sections.yaml](../../map/sections.yaml).
- Read [map/README.md](../../map/README.md) to understand the current structure.

Your job is to:
- inspect the inbox files first
- work out what kind of change they suggest
- ask the minimum questions needed
- then either create a new journey, update an existing version, or create a new version

Interactive questioning (Copilot UI):
- For any missing input, use #tool:vscode/askQuestions so questions appear in the interactive question carousel.
- Ask exactly one question per tool call.
- For fixed-choice fields, provide options and set `allowFreeformInput: false`.
- For free-text fields, provide suggested options where possible and keep `allowFreeformInput: true`.
- Use these fixed options:
  - Change type: `new journey`, `existing version update`, `new version`
  - Mode: `plan`, `implement`

Start by doing this:
1. Inspect the files currently in `map/tmp-inbox`.
2. Summarise what is in the inbox:
   - screenshots
   - PDFs or findings docs
   - anything else
3. Compare that with the existing journeys and versions in `/map`.
4. Run a strict input gate before any plan or implementation:
  - Ask exactly one missing question per response using #tool:vscode/askQuestions.
  - Do not infer or default missing answers.
  - Do not continue until all required answers are confirmed.
5. Ask required questions in this exact order (ask only if not already explicitly answered):
  - Which journey does this belong to?
  - Is this:
    - a new journey
    - an update to an existing version
    - or a new version
  - If it is an existing journey, which version should this work relate to?
  - If it is a new journey, which section should it live in?
  - Do you want a plan first, or should I implement directly?

Rules:
- Always inspect `map/tmp-inbox` before making assumptions.
- Ask exactly one follow-up question at a time.
- If a required answer is missing, ask only the next missing question and stop.
- Do not reorder required questions.
- Do not infer default values for missing answers.
- Use #tool:vscode/askQuestions for follow-up questions so users can select from options in the UI.
- Do not move inbox files until the destination is confirmed.
- Do not create a new version if the files clearly belong to an existing version update.
- Do not update an existing version if the changes represent a materially new tested iteration and should become a new version.
- If the evidence is ambiguous, explain the ambiguity and ask the smallest possible follow-up question.
- Do not infer research findings or next steps unless the inbox includes a findings source and the user asks you to extract them.
- Keep changes small and reviewable.
- If implementing, do not touch unrelated journeys.

Decision rules:
- Choose `new journey` when the inbox represents a distinct user flow that does not already exist in `/map`.
- Choose `existing version update` when the inbox adds screenshots, notes, or assets for a version that already exists and does not represent a new tested iteration.
- Choose `new version` when the inbox represents a later tested iteration of an existing journey with materially changed screens, content, or next steps.

If the user chooses `plan`:
- Return:
  1. Inbox summary
  2. Recommended classification: new journey, existing version update, or new version
  3. The questions still needing answers, if any
  4. The files likely to be created or updated
  5. A short step-by-step plan
- Stop there.

If the user chooses `implement`:
- First restate:
  1. Inbox summary
  2. Chosen classification
  3. Journey, version, and section if relevant
  4. Files you expect to create or update
- Then carry out only that scope.
- Move files from `map/tmp-inbox` only once their destination is clear.
- Finish with a short summary of what changed.

Important:
- This prompt is for inbox triage and setup.
- It should help decide the right shape of the change before editing the map.
