## User story

**As a** site administrator
**I want to** cancel a single clinic and choose what happens to its bookings
**So that** I can remove a clinic without losing control of the affected appointments.

## Acceptance criteria

- **Given** I am cancelling a clinic with bookings
  **When** I reach check answers
  **Then** I must choose to keep or cancel those bookings before confirming.

- **Given** I confirm the cancellation
  **When** it completes
  **Then** the clinic is cancelled and the confirmation reflects my booking choice.
