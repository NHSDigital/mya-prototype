# Manage Your Appointments parity execution plan

Date: 2026-04-14

## Goal

Bring this prototype in line with the real service using vertical slices. Each slice includes:

- Frontend parity for one section
- Backend behavior and data alignment for that section
- Targeted test coverage

## Parity checklist template (use for every section)

- Navigation and entry points match real service
- Page content and labels match real service
- Conditional UI states and feature flags match real service
- Validation rules and error messages match real service
- Success and failure journeys match real service
- Query parameters and persisted state are stable
- Backend route logic enforces the same rules
- Session data shape remains consistent across journeys
- No route depends on middleware from unrelated routes
- Unit tests cover critical helper and route logic

## Recommended delivery model

Use a strip-back-first approach, then rebuild interactions in controlled layers.

1. Baseline shell

   - Keep route URLs and page templates, remove non-essential branching and mutation.
   - Keep only one representative site and one happy-path dataset.
   - Replace deep helper chains with predictable placeholders where safe.

2. Core interaction layer

   - Reintroduce simple read flows first (dashboard, day/week/all availability).
   - Reintroduce one write flow at a time (create, then change, then cancel, then remove).
   - Keep logic local to the route until stable, then extract helper functions.

3. Real-service parity layer

   - Match content, states, validation, and edge cases to production behavior.
   - Restore realistic data generation and secondary scenarios.
   - Add regression tests for each journey before moving on.

4. Hardening

   - Remove temporary fallbacks and dead paths.
   - Normalize naming, state shape, and helper contracts.
   - Confirm all feature flags and concept routes are intentional.

## Proposed slice order

1. Baseline shell and reliability

   - Site context handling across all /site/:id journeys
   - Reduce session state to minimal stable shape
   - Keep filter persistence only where displayed

2. Availability views parity

   - Day and week navigation states
   - All availability table behavior and actions
   - Group details and edit/remove entry points

3. Create availability journey parity

   - Dates, days, time/capacity, services, assurance, check answers
   - Processing and post-submit messaging

4. Change single session journey parity

   - Type selection, group detection, matching flow, check answers, success

5. Cancel date range journey parity

   - Date capture, guidance, sessions/bookings, check answers, success

6. Remove journey parity

   - Selection, booking-cancel choice, check answers, success

7. Feature flags and concepts cleanup

   - Flags pages and route guard behavior
   - Remove dead code and align placeholders to real service behavior

## Slice 1 acceptance criteria

- /site/:id context is available consistently in every site-scoped route module
- Availability grouping uses resolved filters (not stale query/session values)
- /sites does not wipe structural session data required by site pages
- No accidental global variable usage in route handlers
- Existing pages continue to render for site overview and core availability pages

## Baseline shell scope (implemented first)

Journey: availability read flow only

- In scope routes:

   /site/:id, /site/:id/availability/day, /site/:id/availability/week, /site/:id/availability/all

- Baseline data contract:

   Keep res.locals.site_id, slots, availabilityGroups, summaries.
   Keep minimal filters only: from and until.
   Keep date source centralized through one today resolver.

- Out of scope for this strip pass:

   Full parity for create/change/cancel/remove write journeys.
   Complex filter modes beyond from/until.
   Data generation realism tuning.
