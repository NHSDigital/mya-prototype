## Why this journey exists

Sites sometimes need to close for a stretch of time — a bank holiday week, building
work, a staffing gap. Cancelling clinics one day at a time is slow and error-prone, so
this journey lets a user cancel **every clinic in a date range** in one pass.

## Key decisions

- The user chooses dates first, then sees exactly which clinics and bookings fall inside
  the range **before** confirming — no surprises.
- Cancelling the range and cancelling the **bookings** in it are separated: the user
  explicitly chooses to keep or cancel bookings on the check-answers step. Keeping bookings
  is the default because it is the less destructive option.
- Cancelling a recurring clinic for a range records a **closure** against the series rather
  than deleting occurrences, so the underlying schedule is preserved.

## What to try next

- Test whether users understand "keep bookings" vs "cancel bookings" without extra help text.
- Consider showing a per-service breakdown of affected bookings on the review step.
