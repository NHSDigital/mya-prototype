# Month view v3 implementation notes

## NHS components

- Keep top navigation behavior consistent across views and with [Pagination](https://service-manual.nhs.uk/design-system/components/pagination).
- Render each week as a [Card component](https://service-manual.nhs.uk/design-system/components/card) inside `app-panel-list`.
- Use the [Table component](https://service-manual.nhs.uk/design-system/components/table) for service-level booked totals.

## Front-end implementation details

- Build the page heading from month and year and append `(this month)` when it matches today.
- For each week card, show service rows and aggregate totals (`total`, `booked`, `free`) sourced from `monthWeeks`.
- Keep summary text styling aligned with [Typography guidance](https://service-manual.nhs.uk/design-system/styles/typography#paragraphs).
- Keep spacing/alignment consistent with [Spacing guidance](https://service-manual.nhs.uk/design-system/styles/spacing).
- Preserve the no-data state (`No appointments.`) for empty weeks.
