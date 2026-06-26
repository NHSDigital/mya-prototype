## User story

**As a** site administrator
**I want to** change a clinic's details, times, services or closures
**So that** the schedule stays accurate as things change.

## Acceptance criteria

- **Given** I am on a clinic's summary
  **When** I choose to change a property
  **Then** I edit only that property and return to the summary.

- **Given** a change affects existing bookings
  **When** I continue
  **Then** I am shown the affected bookings and must decide how to handle them before saving.

- **Given** I am editing a series
  **When** I view the summary
  **Then** I can change the date(s), days, times, services and closures.
