## User story

**As a** user who manages several sites
**I want to** choose a site and see its dashboard
**So that** every action I take is scoped to the right site.

## Acceptance criteria

- **Given** I am on the all-sites page
  **When** I choose a site
  **Then** I land on that site's dashboard with its own data.

- **Given** I have a half-finished create or cancel flow
  **When** I return to all-sites
  **Then** that transient state is cleared.
