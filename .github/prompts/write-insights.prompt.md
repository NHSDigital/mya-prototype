---
description: "Turn raw notes into per-journey insights.md write-ups, split into the right journeys."
name: "Write insights"
argument-hint: "paste raw notes (any format); optionally name the journey(s)"
agent: "agent"
---

You are writing or updating journey **insights** (the "why we made these changes" write-ups).
Follow `AGENTS.md` (repo root) §8.

1. Take the raw notes the user provides (bullet points, a transcript, a paste — any format).
2. Decide which journey(s) each note belongs to. Journeys live at
   `app/journeys/<version>/<journey>/`. If unsure which journey a note belongs to, ask.
3. For each affected journey, **update its `insights.md`** (create it if missing). Keep it short,
   structured and decision-focused: a brief "Why this journey exists" / key decisions / "What to
   try next". Use markdown headings. Optionally use `## step: <step-id>` to attach a note to a
   specific step.
4. **Do not invent findings.** Only write what the notes support. Preserve existing content; merge
   rather than overwrite.
5. Open `/map/<version>/<journey>` and confirm the insights render on the step pages.

List which files you changed and a one-line summary of each change.
