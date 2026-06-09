# Day view v3 implementation notes

## NHS components

- Keep tab structure and behavior aligned to the [Tabs component](https://service-manual.nhs.uk/design-system/components/tabs).
- Use [Pagination](https://service-manual.nhs.uk/design-system/components/pagination) for day-to-day movement.
- Keep all tabular content aligned to the [Table component](https://service-manual.nhs.uk/design-system/components/table).
- Keep action controls aligned to [Button guidance](https://service-manual.nhs.uk/design-system/components/buttons).

## Front-end implementation details

- Keep the page heading as full date plus `(today)` when selected date matches today, following [Typography guidance](https://service-manual.nhs.uk/design-system/styles/typography#headings).
- Build tab counts from slot data (`scheduled`, `orphaned`, `cancelled`) and session totals for clinics running today.
- Keep variant content generated from the same selected date context so counts, actions, and headings stay in sync.
