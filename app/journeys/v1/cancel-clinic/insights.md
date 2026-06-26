## Why this journey exists

Sometimes a whole clinic needs to go — not a date range, just one clinic. This journey cancels it
and makes the user decide, explicitly, what happens to the bookings already made against it.

## Key decisions

- Keeping vs cancelling bookings is a deliberate choice on the check-answers step, not a hidden
  default, because it has real consequences for patients.

> Note: the example clinic id in `map.json` (`82ac86fd34f9a597`) is a snapshot of the seed data
> (its dates are relative to "today"). Refresh the id and re-capture if the seed dates move.
