# Day view v3 clinics running today variant implementation notes

## NHS components

- Use the [Table component](https://service-manual.nhs.uk/design-system/components/table) for clinic session rows (time, services, booked, free, actions).
- Keep action links as a list (`nhsuk-list nhsuk-u-margin-bottom-0`) aligned with [List styles guidance](https://service-manual.nhs.uk/design-system/styles/typography#lists).

## Front-end implementation details

- Service names and booked counts can be multi-line inside a cell, separated with line breaks to match session data.
- Add visually hidden context to each action link with full date and time range, following the accessibility principle from [Summary list action links](https://service-manual.nhs.uk/design-system/components/summary-list).
- Show `No clinics running today.` when no sessions are available.
