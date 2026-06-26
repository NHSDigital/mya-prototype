## User story

**As a** site administrator
**I want to** create a single clinic or a recurring clinic series
**So that** appointments can be booked against the right availability.

## Acceptance criteria

### Choosing the type

- **Given** I start creating a clinic
  **When** I choose "single date" or "weekly series"
  **Then** the following steps adapt to that choice (series shows days and closures; single does not).

### Times and capacity

- **Given** I enter start time, end time, appointment length and capacity
  **When** I continue
  **Then** I see the resulting number of appointments per clinic.

### Review

- **Given** I have completed the steps
  **When** I reach check answers
  **Then** I can review every choice and change any of them before creating the clinic.
