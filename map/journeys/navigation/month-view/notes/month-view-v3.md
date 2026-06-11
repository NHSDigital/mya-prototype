## Changes compared with live

- Replace the live top navigation item "View availability" with "Clinics"; remove "Create availability".
- Add "Create and manage clinics" to the secondary navigation after "Month view".
- Remove the live "Change availability" button.
- Remove the live site-name caption above the page heading; do not render an `nhsuk-caption-l` before the `<h1>`.
- Change the heading from "View availability for June 2026" to "June 2026".
- Append "(this month)" to the heading when the selected month contains today.
- Change the summary label from "Unbooked" to "Free".
- Remove the live explanatory note about bookings kept when availability changed or was cancelled.

## NHS components and patterns

- Use the [Secondary navigation pattern](https://service-manual.nhs.uk/design-system/components/header#navigation) for day, week, month, and clinic management links.
- Use [Pagination](https://service-manual.nhs.uk/design-system/components/pagination) for month-to-month movement.

## Markup and structure

- Render the selected month as `<h1 class="nhsuk-heading-l">`.
- Do not render a site-name caption before the `<h1>`.
- "View and change" and "Cancel" links should be rendered as a list, eg:

```html
<ul class="nhsuk-list nhsuk-u-margin-bottom-0">
  <li>
    <a href="...">
      View and change
      <span class="nhsuk-u-visually-hidden">
        clinic on 19 May 2026 to 9 Aug 2026 at 11am to 3pm
      </span>
    </a>
  </li>
  <li>
    <a href="...">
      Cancel
      <span class="nhsuk-u-visually-hidden">
        clinic on 19 May 2026 to 9 Aug 2026 at 11am to 3pm
      </span>
    </a>
  </li>
</ul>
```

## Behaviour and data

- Append "(this month)" only when the selected month matches today's month.

## Error, empty, and edge states

- Preserve the no-data state "No appointments." for empty weeks.
- Do not render an empty table for a week with no service rows.
- Keep all week cards visible so users can scan the full month.

## Accessibility details

Add visually hidden context on "View and change" and "Cancel" links, following the accessibility principle from [Summary list action links](https://service-manual.nhs.uk/design-system/components/summary-list), for example:

```html
<a href="...">
  View and change
  <span class="nhsuk-u-visually-hidden">
    clinic on 9 May to 9 Aug 2026 at 11am to 3pm
  </span>
</a>
```

The hidden context should always include the clinic date label and time range.
