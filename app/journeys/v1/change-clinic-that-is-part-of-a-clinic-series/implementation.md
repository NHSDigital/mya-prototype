## User story

**As a** site administrator
**I want to** change a single occurrence of a clinic series
**So that** I can handle one-off differences without editing the whole series.

## Acceptance criteria

- **Given** I am changing one occurrence of a series
  **When** I view the change options
  **Then** I can change the times, capacity and services for that occurrence only, and there is no
  option to change the date.

- **Given** the occurrence is actually a standalone single clinic
  **When** I open it from this journey
  **Then** I am redirected to the "Change a clinic" journey, which can edit it as a first-class object.

- **Given** I save a one-off change
  **When** it completes
  **Then** the rest of the series is unaffected.
