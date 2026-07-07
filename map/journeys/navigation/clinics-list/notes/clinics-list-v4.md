## Changes compared with live

This new page completely replaces the live Create availability page

## NHS components and patterns

- Keep secondary navigation links in this order: "Day view", "Week view", "Month view", then "Create and manage clinics".
- Use [Button guidance](https://service-manual.nhs.uk/design-system/components/buttons) for the action control bar.
- Render current and completed clinics using the [Table component](https://service-manual.nhs.uk/design-system/components/table) with responsive behavior.
- Use the [Tag component](https://service-manual.nhs.uk/design-system/components/tag) for "Single" and "Series".
- Use the [Details component](https://service-manual.nhs.uk/design-system/components/details) for "Completed clinic series".

## Markup and structure

- Render "Create and manage clinics" as the page `<h1>`.
- Render the action control bar directly after the `<h1>` using a [smaller button group](https://service-manual.nhs.uk/design-example/components/buttons/smaller-group).

### Specific markup for the table

In order to maintain a readable line height and make it easier to scan the data, there are some markup considerations in the table.

Here's an example table row:

```html
<tbody class="nhsuk-table__body" role="rowgroup">
  <tr class="nhsuk-table__row" role="row">
    <td class="nhsuk-table__cell" role="cell">
      <strong class="nhsuk-tag nhsuk-tag--blue">Series</strong>
    </td>

    <td class="nhsuk-table__cell" role="cell">
      <ul class="nhsuk-list nhsuk-u-margin-bottom-0">
        <li>Monday</li>
        <li>Tuesday</li>
        <li>Wednesday</li>
        <li>Thursday</li>
        <li>Friday</li>
      </ul>
    </td>

    <td class="nhsuk-table__cell" role="cell">
      <div>11am to 3pm</div>
      <div class="nhsuk-u-margin-top-2">19 May 2026 to 9 Aug 2026</div>
    </td>

    <td class="nhsuk-table__cell" role="cell">
      <ul class="nhsuk-list nhsuk-u-margin-bottom-0">
        <li>COVID 18+</li>
        <li>COVID and Flu 18 to 64</li>
        <li>COVID and Flu 65+</li>
        <li>Flu 18 to 64</li>
        <li>Flu 65+</li>
      </ul>
    </td>

    <td class="nhsuk-table__cell" role="cell">
      <a href="...">
        Cancel
        <span class="nhsuk-u-visually-hidden">
          clinic on 19 May 2026 to 9 Aug 2026 at 11am to 3pm
        </span>
      </a>
    </td>
  </tr>
</tbody>
```

## Behaviour and data

- Clinic series should always been shown at the top of the list
- Clinics should then be ordered by
  - date for single clinics
  - or, startDate for clinic series
- Pagination should show 10 items per page

## Error, empty, and edge states

- If there are no current clinics, show `<p>No clinics have been created yet.</p>` under the `h1`.
- If there are no completed clinic series, do not show the details component at all.

## Accessible View and change and Cancel links

Add visually hidden context on "Change" and "Cancel" links, following the accessibility principle from [Summary list action links](https://service-manual.nhs.uk/design-system/components/summary-list), for example:

```html
<a href="...">
  Cancel
  <span class="nhsuk-u-visually-hidden">
    clinic on 9 May to 9 Aug 2026 at 11am to 3pm
  </span>
</a>
```

The hidden context should always include the clinic date label and time range.
