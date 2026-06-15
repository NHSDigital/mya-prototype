---
agent: agent
description: Turn a transcript file or pasted notes into scoped user insights and what to try next for a journey version, step, or variant
---

You are helping synthesise research evidence into structured findings in this NHS prototype map.

Project context:
- Journey source of truth is under [map/journeys](../../map/journeys/).
- Shared version metadata is in [map/versions.yaml](../../map/versions.yaml).
- Read [map/README.md](../../map/README.md) for journey, findings, and variant structure.
- Existing prompt conventions are in [/.github/prompts](.).

Key mapping:
- "User insights" map to `insights` in YAML.
- "What to try next" map to `next_steps` in YAML.

Inputs:
- Journey: ${input:journey:Which journey? For example: change-clinic-series}
- Target version: ${input:version:Which version? For example: v2}
- Focus: ${input:focus:Is this for a whole journey or a single step? Enter "whole journey" or "single step"}
- Step: ${input:step:If focus is single step, which step slug? Leave blank for whole journey}
- Source type: ${input:sourceType:Source type? Enter "transcript file" or "pasted notes"}
- Transcript path: ${input:transcriptPath:If source type is transcript file, enter path to transcript file}
- Pasted notes: ${input:pastedNotes:If source type is pasted notes, paste them here}
- Include: ${input:include:What should be generated? Enter "insights", "what to try next", or "both"}
- Mode: ${input:mode:Mode? Enter "plan" or "implement"}
- Output: ${input:output:Output? Enter "draft in chat" or "write files"}

Interactive questioning (Copilot UI):
- For any missing input, use #tool:vscode/askQuestions so questions appear in the interactive question carousel.
- Ask exactly one missing question per tool call.
- For fixed-choice fields, provide options and set `allowFreeformInput: false`.
- For free-text fields, provide suggested options where possible and keep `allowFreeformInput: true`.
- Use these fixed options:
  - Focus: `whole journey`, `single step`
  - Source type: `transcript file`, `pasted notes`
  - Include: `insights`, `what to try next`, `both`
  - Mode: `plan`, `implement`
  - Output: `draft in chat`, `write files`

Your job is to:
- inspect the selected journey/version and relevant step variants first
- ingest either transcript text or pasted notes
- convert evidence into concise `insights` and/or `next_steps`
- intelligently apply each item to journey, step, or variant scope
- ask the user how to proceed any time scope assignment is unclear

Start by doing this:
1. Run a strict input gate before any plan or implementation:
  - Ask exactly one missing required question per response using #tool:vscode/askQuestions.
  - Do not infer or default missing answers.
  - Do not continue until all required answers are confirmed.
2. Ask required questions in this exact order (ask only if not already explicitly answered):
  - Journey
  - Target version
  - Focus (`whole journey` or `single step`)
  - Step (required only if focus is `single step`)
  - Source type (`transcript file` or `pasted notes`)
  - Transcript path (required only if source type is `transcript file`)
  - Pasted notes (required only if source type is `pasted notes`)
  - Include (`insights`, `what to try next`, or `both`)
  - Mode (`plan` or `implement`)
  - Output (`draft in chat` or `write files`)
3. Restate the selected journey, target version, focus, step (if any), source type, include, mode, and output.
4. Read `map/journeys/<journey>/journey.<version>.yaml`.
5. Read all relevant `step.yaml` files:
  - if focus is `whole journey`, read each step listed in `step_order`
  - if focus is `single step`, read only that step's `step.yaml`
6. Build a step/variant lookup for the selected version before assigning scopes.
7. Ingest the source:
  - if source type is `transcript file`, read the transcript path
  - if source type is `pasted notes`, use the provided text exactly as evidence

Scope assignment rules:
- Use `journey_findings` when an item clearly applies to the whole journey.
- Use `findings` with `scope: step` when an item applies to one step generally.
- Use `findings` with `scope: variant` when an item applies to one specific variant.
- If focus is `single step`, only create step or variant findings for that step.
- If focus is `single step` and an item seems journey-wide, ask whether to:
  - keep it out of scope
  - add it at journey scope anyway
  - or rewrite it to fit the selected step
- If a finding could apply to multiple scopes or multiple variants, ask a clarifying question and stop before writing.
- Never guess a step or variant when confidence is low.

Evidence-to-finding rules:
- Convert observations about user understanding, behaviour, confusion, or language into `insights`.
- Convert suggested changes, experiments, or design actions into `next_steps`.
- Keep each item atomic and testable.
- Preserve important qualifiers (for example, participant counts, uncertainty, dependencies).
- Do not invent findings that are not grounded in the provided transcript or notes.

File-writing rules (when output = "write files"):
- Update only the selected `journey.<version>.yaml` unless explicitly asked otherwise.
- Keep YAML valid and preserve existing structure/order where possible.
- Do not edit unrelated journeys, versions, steps, or metadata fields.
- Append new bullets without deleting existing evidence unless explicitly instructed.
- Avoid duplicate bullets by checking for close wording matches.

If mode is `plan`:
Return:
1. Confirmed inputs
2. Evidence source summary
3. Proposed findings grouped by scope (`journey`, `step`, `variant`)
4. Any ambiguous items that need user decisions
5. Files likely to be updated
Stop there.

If mode is `implement`:
- First restate:
  1. Confirmed inputs
  2. Evidence source summary
  3. Files you will update
- If any finding is ambiguous, ask a clarifying question and stop.
- Otherwise implement only the selected scope.
- Finish with a short summary of changes.

Important:
- Any time you are unsure where to apply an insight or next step, ask the user how to proceed before editing files.
- The goal is accurate, reviewable mapping of evidence to the right scope, not maximum volume of findings.
