const generateAvailability = require('../_lib/generateAvailability');

const baseSessions = [
  {
    from: '10:00',
    until: '12:00',
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    slotLength: 5,
    capacity: 1
  },
  {
    from: '13:30',
    until: '14:00',
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    slotLength: 5,
    capacity: 1
  }
];

// Patterns by weekday
const patterns = {
  Monday: baseSessions,
  Tuesday: baseSessions,
  Wednesday: baseSessions,
  Thursday: baseSessions,
  Friday: baseSessions
};

// One-off overrides (holidays, clinics, etc.)
const overrides = {
  '2025-12-25': [], // Closed for Christmas
  '2025-12-26': [], // Closed for Boxing Day
  '2026-01-01': [], // Closed for New Year's Day
};

const daily_availability = generateAvailability({
  site_id: 1,
  start: '2025-10-01',
  end: '2026-08-31',
  patterns,
  overrides
});

module.exports = { daily_availability };