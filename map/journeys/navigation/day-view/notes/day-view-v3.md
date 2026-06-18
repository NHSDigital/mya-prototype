# Day view v3 implementation notes

## Changes compared with live

- Replace the live top navigation item "View availability" with "Clinics"; remove "Create availability".
- Add "Create and manage clinics" to the secondary navigation after "Month view".
- Remove the live "Change availability" button from the page-level action controls.
- Remove the site-name caption above the page heading.
- Change the page heading from the live date-only form to a full `<h1>` date that appends "(today)" when the selected date is today.
- Keep "Print page" as the only visible action control on the day view.
- Add appointment counts to tab labels, for example "Scheduled (10)" and "Cancelled (4)".

## NHS components and patterns

- Use the [Tabs component](https://service-manual.nhs.uk/design-system/components/tabs) for scheduled and cancelled appointment views.
- Use [Pagination](https://service-manual.nhs.uk/design-system/components/pagination) for previous and next day movement.
- Use the [Table component](https://service-manual.nhs.uk/design-system/components/table) for appointment lists.
- Keep action controls aligned to [Button guidance](https://service-manual.nhs.uk/design-system/components/buttons).

## Markup and structure

- Render the secondary navigation before the page heading.
- Render the date as a single `<h1 class="nhsuk-heading-xl">`; do not place the site name in a caption above it.
- Keep the page action controls immediately after the `<h1>`.
- Keep the previous/next day pagination before the tabs.
- Keep the tab panels generated from the same selected date as the heading and pagination.

## Behaviour and data

- Build "pageName" from the selected date and append "(today)" only when "date == today".
- Count scheduled appointments from slots with "scheduled" or "orphaned" booking status.
- Count cancelled appointments from slots with "cancelled" booking status.
- Use the same date context for heading text, pagination links, tab counts, and appointment rows.
- Keep clinics-running-today data separate from appointment data unless that tab is restored to the v3 journey.

## Error, empty, and edge states

- If a tab has no matching appointments, show the tab panel heading and a plain "No appointments." message.
- Keep scheduled and cancelled counts at "0" when there are no matching slots.
- Keep previous and next pagination available even when the selected day has no appointments.

## Accessibility details

- The selected date must be exposed as the page `<h1>`.
- Tab labels should include the visible count so users can understand the contents before opening a tab.
- Appointment action links need visually hidden context that includes the appointment name and time.
- Keep table column headings explicit and visible in both desktop and responsive table layouts.
