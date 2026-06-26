# Availability to Appointments Copy Changes

Date: 2026-04-20
Scope: User-facing copy only (no route or data model key renames)

## Change Table

| Area | Old text | New text | File |
|---|---|---|---|
| Site navigation card | View availability | View appointments | app/data/session-data-defaults.js |
| Site navigation card description | View and manage available appointments for your site | View and manage appointments for your site | app/data/session-data-defaults.js |
| Action button | Change availability | Change appointments | app/views/includes/addCancelButtons.njk |
| Week view empty state | No availability | No appointments. | app/views/site/availability/week.html |
| Homepage hero text | create and manage availability | create and manage appointments | app/views/index.html |
| Change flow caption | Change availability | Change appointments | app/views/site/change-session/check-answers-single.html |
| Change flow guidance | If you want to increase availability for this day, you must create a new session. | If you want to increase appointment capacity for this day, you must create a new session. | app/views/site/change-session/index.html |
| Cancel flow success link | Go back to availability | Go back to appointments | app/views/site/cancel-availability/success.html |
| Clinic success guidance (series) | availability screens | appointments screens | app/views/site/clinics/series/success.html |
| Clinic success link (series) | View availability | View appointments | app/views/site/clinics/series/success.html |
| Clinic success guidance (single) | availability screens | appointments screens | app/views/site/clinics/single/success.html |
| Clinic success link (single) | View availability | View appointments | app/views/site/clinics/single/success.html |

## Notes

- URLs remain unchanged (for example: /availability/day).
- Internal model names remain unchanged (for example: daily_availability).
- This update intentionally focused on interface wording only.
