## Why this journey exists

Clinics change — times shift, services change, a date needs to close. This journey edits a
**first-class clinic** (a single clinic or a whole series). Because it edits the real object, the
**date is editable** here, unlike changing a single occurrence of a series.

## Key decisions

- One summary page is the hub: every property has its own "Change" link, so users edit just the
  thing they came to change rather than walking a wizard.
- Changes that affect existing bookings surface an explicit "affected bookings" step before saving.

> Note: the example clinic id in `map.json` (`82ac86fd34f9a597`) is a snapshot of the seed data,
> whose dates are relative to "today". If the seed dates move, refresh the id and re-capture.
