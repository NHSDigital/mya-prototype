# Day view v3 cancelled variant implementation notes

## NHS components

- Keep the same responsive structure as the [Table component](https://service-manual.nhs.uk/design-system/components/table#responsive-table) used in Scheduled.
- Keep row text treatment consistent with [Typography guidance](https://service-manual.nhs.uk/design-system/styles/typography#paragraphs).

## Front-end implementation details

- Users should be able to understand these appointments are already cancelled.
- Do not render an Actions column in this variant.
- Cancelled variant filters to `cancelled` booking status only.
- Keep person and contact fields in the same layout as Scheduled to reduce cognitive switching.
- Keep empty state as a plain paragraph (`No appointments.`).
