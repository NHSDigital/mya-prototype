## Changes to day view

1. Add a link "Create and manage clinics" to the secondary navigation
1. Remove "Change availability" button
1. Ensure the main title on the page uses a `<h1>`, currently it’s using `<h2>`
1. Remove the caption (eg `<span class="nhsuk-caption-l">Dean's pharmacy</span>`) above the `<h1>`
1. Add a `<caption>` element "Scheduled appointments" to the [table component](https://service-manual.nhs.uk/design-system/components/table)
1. A a count of scheduled appointments in the tab in brackets. For example, `(0)`, `(12)`, etc
1. Show (today) after the `<h1>` date, if it's today.

### If there are no booked appointments

The table should be replaced with the following markup

```
<h2 class="nhsuk-heading-m">Scheduled appointments</h2>
<p>No appointments</p>
```