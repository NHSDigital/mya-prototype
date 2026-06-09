---
agent: agent
description: Generate or implement structured map notes for a journey version, including baseline diffs, markup guidance, and error states
---

You are helping write implementation notes for journey map screens in this NHS prototype.

Project context:
- Journey source of truth is under [map/journeys](../../map/journeys/).
- Shared version metadata is in [map/versions.yaml](../../map/versions.yaml).
- Read [map/README.md](../../map/README.md) for map structure and notes_file rules.
- Existing prompts in [/.github/prompts](.) show expected workflow style.

Inputs:
- Journey: ${input:journey:Which journey? For example: navigation}
- Target version: ${input:version:Which version? For example: v3}
- Reformat: ${input:reformat:Reformat existing notes? Enter "yes" or "no"}
- Baseline: ${input:baseline:Compare against "previous version", "live baseline", or "none"}
- Mode: ${input:mode:Mode? Enter "plan" or "implement"}
- Output: ${input:output:Output? Enter "draft in chat" or "write files"}

Interactive questioning (Copilot UI):
- For any missing input, use #tool:vscode/askQuestions so questions appear in the interactive question carousel.
- Ask all currently missing required inputs in one #tool:vscode/askQuestions call, preserving required order.
- For fixed-choice fields, provide options and set `allowFreeformInput: false`.
- For free-text fields, provide suggested options where possible and keep `allowFreeformInput: true`.
- Use these fixed options:
  - Baseline: `previous version`, `live baseline`, `none`
  - Mode: `plan`, `implement`
  - Output: `draft in chat`, `write files`
  - Reformat: `yes`, `no`

Your job is to:
- inspect relevant journey/version/step files first
- ask the minimum follow-up questions needed (one at a time)
- then draft notes or write notes files and notes_file links

Start by doing this:
1. Run a strict input gate before any plan or implementation:
  - Ask all missing required inputs using one ordered #tool:vscode/askQuestions call.
  - Do not infer or default missing answers.
  - If any required answer is skipped or canceled, ask only the missing required field next and stop.
  - Do not continue until all required answers are confirmed.
2. Confirm required inputs in this exact order (ask only if not already explicitly answered):
  - Journey
  - Target version
  - Baseline (`previous version`, `live baseline`, or `none`)
  - Mode (`plan` or `implement`)
  - Output (`draft in chat` or `write files`)
  - Reformat (`yes` or `no`)
3. Restate the selected journey, target version, baseline, mode, output, and reformat choice.
4. Read the selected `journey.vX.yaml`, all related `step.yaml` files in that journey version's `step_order`, and any existing notes files.
5. List all steps and variants in the selected journey version.
6. If baseline is "previous version", identify the nearest earlier version and summarize key differences.
7. If baseline is "live baseline":
   - look for live reference evidence in `map/tmp-inbox` first
   - if none is present, ask for live baseline evidence before writing "changes from live"

Required note sections (for each step and variant in the selected journey version):
1. `Changes from baseline`
2. `NHS components and patterns`
3. `Markup and structure`
4. `Behaviour and data`
5. `Error, empty, and edge states`
6. `Accessibility details`
7. `Open questions or assumptions` (optional, only if needed)

Authoring rules:
- For required inputs, prefer one ordered #tool:vscode/askQuestions call containing all currently missing required fields.
- If any required answer is missing after that call, ask only the next missing required question and stop.
- Do not reorder required questions.
- Do not infer default values for missing answers.
- Keep notes implementation-oriented and specific.
- Prefer observable statements over abstract guidance.
- Include NHS design system links whenever you mention a component or pattern.
- Do not invent differences if baseline evidence is missing.
- If a section has no confirmed evidence, explicitly write `No confirmed changes for this section.`
- Use concise markdown with headings and bullets.

File-writing rules (when output = "write files"):
- Use `notes_file` for notes, do not write long inline `notes` blocks in YAML.
- Keep existing `notes_file` paths where possible; update file content in place.
  - Reformat existing notes if requested.
- If adding a new notes file, create it under the step folder, for example:
  - `map/journeys/<journey>/<step>/notes/<step>-<version>.md`
- Create or update variant notes files for every variant in the selected journey version.
- If `notes_file` is missing for target step/variant, add it.
- Do not edit unrelated journeys, versions, or steps.

Decision rules for baseline:
- Prefer `previous version` for product iteration diffs.
- Use `live baseline` when the user provides current-production evidence (screenshots, recordings, audited notes).
- Do not represent live baseline as a normal tested version by default.
- Once you've done with files in `map/tmp-inbox`, you should delete them to avoid confusion with future evidence.

If mode is `plan`:
Return:
1. Confirmed journey/version and baseline
2. Evidence reviewed
3. Proposed notes structure per step/variant
4. Gaps or missing evidence
5. Files likely to be created or updated
Stop there.

If mode is `implement`:
First restate:
1. Confirmed journey/version and baseline
2. Evidence reviewed
3. Files you will update
Then implement only for the selected journey version.
Finish with a short summary of changes.

Important:
- This prompt is for notes generation and maintenance per journey version.
- It should produce consistent, reviewable notes across steps and variants.
