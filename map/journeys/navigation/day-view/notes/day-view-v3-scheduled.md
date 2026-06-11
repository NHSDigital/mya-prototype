## Changes compared with live

- Add "Create and manage clinics" to the secondary navigation.
- Remove the live "Change availability" button.
- Use `<h1>` and not `<h2>` for the date heading 
- Remove the caption above the `<h1>`
- Append "(today)" to the heading when the selected date is today.
- Add the scheduled count to the tab label, for example "Scheduled (10)".
- Add `<h2>` "Scheduled appointments" before the table
- Change the table column heading from "Action" to "Actions".

## NHS components and patterns

- Use the [Table component](https://service-manual.nhs.uk/design-system/components/table) for appointment rows.
- Use standard [Typography guidance](https://service-manual.nhs.uk/design-system/styles/typography#headings) for the `<h1>` and tab-panel `<h2>`.

## Markup and structure

- Render the selected date as `<h1 class="nhsuk-heading-l">`.
- Do not render `<span class="nhsuk-caption-l">Dean's pharmacy</span>` or any other site-name caption above the `<h1>`.

## Behaviour and data

- Include both "scheduled" and "orphaned" slots in the Scheduled tab.
- Keep the cancel action available only for scheduled appointment rows.

## Error, empty, and edge states

- If there are no scheduled appointments, replace the table with:

```html
<h2 class="nhsuk-heading-m">Scheduled appointments</h2>
<p>No appointments.</p>
```

- Show "Scheduled (0)" when the selected date has no scheduled or orphaned slots.
- Preserve the tab even when the table is empty so users can still see the scheduled appointment state.

## Accessibility details

- The appointment date must be the only page `<h1>`.
- The "Scheduled appointments" heading gives the tab panel a visible label before the table.
- Format the NHS number inline with the [NHS number content guidance](https://service-manual.nhs.uk/content/a-to-z-of-nhs-health-writing#nhs-number).
- Each "Cancel" link needs visually hidden context, for example the appointment name and time, here's an example:

```html
<a href="...">
  Cancel
  <span class="nhsuk-u-visually-hidden">
    booked appointment on 9 May 2026 at 11am to 11:05am
  </span>
</a>
```
