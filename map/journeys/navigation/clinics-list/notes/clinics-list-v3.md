# Clinics list v3 implementation notes

## NHS components

- Keep top navigation links in this order: Day view, Week view, Month view, then Create and manage clinics.
- Use [Button guidance](https://service-manual.nhs.uk/design-system/components/buttons) for the action control bar (Create clinics / Cancel all clinics).
- Render rows using the [Table component](https://service-manual.nhs.uk/design-system/components/table) with responsive behavior.
- Use the [Tag component](https://service-manual.nhs.uk/design-system/components/tag) for Single vs Series.
- Use the [Details component](https://service-manual.nhs.uk/design-system/components/details) for Completed clinic series.

## Front-end implementation details

- Keep services and actions as lists using `nhsuk-list nhsuk-u-margin-bottom-0`, aligned with [List styles guidance](https://service-manual.nhs.uk/design-system/styles/typography#lists).
- Keep the time/date cell split into 2 lines with `nhsuk-u-margin-top-2` so text lines up with list content in adjacent cells, following [Spacing guidance](https://service-manual.nhs.uk/design-system/styles/spacing).
- Keep column structure aligned with the [Layout grid guidance](https://service-manual.nhs.uk/design-system/styles/layout#grid).
- Add visually hidden context on View and change / Cancel links, following the accessibility principle from [Summary list action links](https://service-manual.nhs.uk/design-system/components/summary-list).
- Keep clinic type and day/date labeling in macros (`typeLabel`, `daysLabel`, `dateLabel`) so series and single clinics stay consistent.
- Show empty states with the [Inset text component](https://service-manual.nhs.uk/design-system/components/inset-text) when there are no current clinics.
