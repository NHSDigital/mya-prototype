## Changes compared with live

- Add "Create and manage clinics" to the secondary navigation.
- Remove the live "Change availability" button.
- Use `<h1>` and not `<h2>` for the date heading.
- Remove the caption above the `<h1>`
- Append "(today)" to the heading when the selected date is today.
- Add the cancelled count to the tab label, for example "Cancelled (10)".
- Add `<h2>` "Cancelled appointments" before the table

## NHS components and patterns

- Use the [Tabs component](https://service-manual.nhs.uk/design-system/components/tabs) for the cancelled appointment panel.
- Keep the same responsive [Table component](https://service-manual.nhs.uk/design-system/components/table#responsive-table) structure as the Scheduled tab.
- Use standard [Typography guidance](https://service-manual.nhs.uk/design-system/styles/typography#headings) for the tab-panel heading.

## Markup and structure

- Render "Cancelled appointments" as an `<h2 class="nhsuk-heading-m">` before the table.
- Use the same table columns as Scheduled, except omit "Actions".
- Keep person, NHS number, date of birth, contact details, and service in the same column order as Scheduled to reduce cognitive switching.
- Do not render action links for cancelled rows.

## Behaviour and data

- Filter this tab to slots with "cancelled" booking status only.
- Build the cancelled tab count from the same slot filter used for table rows.
- Show cancelled appointments as historical/reference information rather than actionable rows.

## Error, empty, and edge states

- If there are no scheduled appointments, replace the table with:

```html
<h2 class="nhsuk-heading-m">Scheduled appointments</h2>
<p>No appointments.</p>
```

- Show "Cancelled (0)" on the tab when the selected date has no cancelled slots.
- Keep the tab visible even when it is empty so the scheduled/cancelled structure remains predictable.

## Accessibility details

- The "Cancelled appointments" heading gives the tab panel a visible label before the table.
- Do not include an empty "Actions" column; this avoids announcing a column with no usable controls.
