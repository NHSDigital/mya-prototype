## Why this journey exists

Most users manage more than one site, so the prototype starts with a **site picker** and gives
each site its own dashboard. Site-specific data (user, clinics, bookings) is scoped per site so
switching sites is unambiguous.

## Key decisions

- The dashboard is the single entry point to every other journey for a site.
- Returning to "All sites" resets transient state (filters, in-progress create/cancel flows) so a
  user never carries half-finished work between sites.
