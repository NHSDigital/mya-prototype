## User story

**As a** site administrator
**I want to** cancel all clinics within a date range in one action
**So that** I can quickly close the site for holidays or disruption without editing each clinic.

## Acceptance criteria

### Choosing the range

- **Given** I am on the cancel-a-date-range start page
  **When** I enter a valid start and end date
  **Then** I see every clinic and booking that falls within that range before I confirm.

### Keeping bookings

- **Given** the range contains booked appointments
  **When** I choose "keep bookings" and confirm
  **Then** the clinics are cancelled but the bookings remain and are not notified.

### Cancelling bookings

- **Given** the range contains booked appointments
  **When** I choose "cancel bookings" and confirm
  **Then** the clinics are cancelled, the bookings are cancelled, and the confirmation shows how
  many were affected.

### Recurring clinics

- **Given** a recurring clinic series overlaps the range
  **When** I confirm the cancellation
  **Then** a closure is recorded against the series for that range rather than deleting the series.
