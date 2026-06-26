## Why this journey exists

Creating clinics is the most frequent setup task, and it has two shapes: a **single** one-off
clinic and a **recurring series**. Rather than two separate journeys, the flow branches early (at
"type of clinic") and then reuses the same steps, hiding the series-only steps (days, closures)
for single clinics.

## Key decisions

- The single vs series choice is made once, up front, and drives which steps appear.
- Times, capacity and appointment length feed a live "appointments per clinic" calculation so the
  user sees the impact of their choices before creating.

## What to try next

- Test whether users expect to set closures during creation or add them later when editing.
