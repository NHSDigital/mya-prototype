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
- Scope: ${input:scope:Scope? Enter "journey", "step", or "both"}
- Reformat: ${input:reformat:Reformat existing notes? Enter "yes" or "no"}
- Step: ${input:step:If scope includes step, which step slug? Leave blank otherwise}
- Baseline: ${input:baseline:Compare against "previous version", "live baseline", or "none"}
- Mode: ${input:mode:Mode? Enter "plan" or "implement"}
- Output: ${input:output:Output? Enter "draft in chat" or "write files"}

Your job is to:
- inspect relevant journey/version/step files first
- ask the minimum follow-up questions needed (one at a time)
- then draft notes or write notes files and notes_file links

Start by doing this:
1. Restate the selected journey, target version, scope, step, baseline, mode, and output.
2. Read the selected `journey.vX.yaml`, related `step.yaml` files, and any existing notes files.
3. List which steps and variants are in scope.
4. If baseline is "previous version", identify the nearest earlier version and summarize key differences.
5. If baseline is "live baseline":
   - look for live reference evidence in `map/tmp-inbox` first
   - if none is present, ask for live baseline evidence before writing "changes from live"

Required note sections (per step or variant in scope):
1. `Changes from baseline`
2. `NHS components and patterns`
3. `Markup and structure`
4. `Behaviour and data`
5. `Error, empty, and edge states`
6. `Accessibility details`
7. `Open questions or assumptions` (optional, only if needed)

Authoring rules:
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
- If scope includes variants, create or update variant notes files too.
- If `notes_file` is missing for target step/variant, add it.
- Do not edit unrelated journeys, versions, or steps.

Decision rules for baseline:
- Prefer `previous version` for product iteration diffs.
- Use `live baseline` when the user provides current-production evidence (screenshots, recordings, audited notes).
- Do not represent live baseline as a normal tested version by default.
- Once you've done with files in `map/tmp-inbox`, you should delete them to avoid confusion with future evidence.

If mode is `plan`:
Return:
1. Confirmed scope and baseline
2. Evidence reviewed
3. Proposed notes structure per step/variant
4. Gaps or missing evidence
5. Files likely to be created or updated
Stop there.

If mode is `implement`:
First restate:
1. Confirmed scope and baseline
2. Evidence reviewed
3. Files you will update
Then implement only that scope.
Finish with a short summary of changes.

Important:
- This prompt is for notes generation and maintenance per journey version.
- It should produce consistent, reviewable notes across steps and variants.
