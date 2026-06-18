## Changes compared with live

- Replace the live top navigation item "View availability" with "Clinics"; remove "Create availability".
- Add "Create and manage clinics" to the secondary navigation after "Month view".
- Remove the live "Change availability" button.
- Remove the live site-name caption above the page heading.
- Change the page heading to a date range and append "(this week)" when the selected week contains today.
- Change the availability summary label from "Unbooked" to "Free".
- Rename "Add Session" to "Add clinic".
- Rename "View daily appointments" to "View appointments".
- Use "View and change" and "Cancel" action links for clinic sessions where actions are available.

## NHS components and patterns

- Use the [Secondary navigation pattern](https://service-manual.nhs.uk/design-system/components/header#navigation) for day, week, month, and clinic management links.
- Use [Pagination](https://service-manual.nhs.uk/design-system/components/pagination) for week-to-week movement.
- Render each day as a [Card component](https://service-manual.nhs.uk/design-system/components/card).
- Use the [Table component](https://service-manual.nhs.uk/design-system/components/table) for day-level clinic session rows.
- Keep links and grouped controls aligned to [Typography list guidance](https://service-manual.nhs.uk/design-system/styles/typography#lists).

## Markup and structure

- Render the selected week range as `<h1 class="nhsuk-heading-l">`.
- Do not render a site-name caption before the `<h1>`.
- Append "(today)" to the date for for today's card.
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

- Append "(this week)" only when today falls within the selected week.

## Error, empty, and edge states

- For a day with no sessions, show "No clinics running." and an "Add clinic" link.
- Do not show an empty table for a day with no sessions.
- Keep a card for every day in the selected week so users can scan the full week.

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
