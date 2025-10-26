const generateAvailability = require('../_lib/generateAvailability');

const baseSessions = [
  {
    from: '09:30',
    until: '13:00',
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    slotLength: 10,
    capacity: 1
  },
  {
    from: '14:00',
    until: '17:00',
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    slotLength: 10,
    capacity: 1
  }
];

// Patterns by weekday
const patterns = {
  Monday: baseSessions,
  Tuesday: baseSessions,
  Wednesday: baseSessions,
  Thursday: baseSessions,
  Sunday: baseSessions
};

// One-off overrides (holidays, clinics, etc.)
const overrides = {
  '2025-12-25': [], // Closed for Christmas
  '2025-12-26': [], // Closed for Boxing Day
  '2026-01-01': [
    { from: '10:00', until: '13:00', services: ['FLU:18-64'], slotLength: 20, capacity: 1 }
  ], // Reduced hours for New Year's Day
  '2025-12-27': [
    { from: '10:00', until: '13:00', services: ['FLU:18-64'], slotLength: 10, capacity: 1 }
  ]
};

const daily_availability = generateAvailability({
  site_id: 2,
  start: '2025-10-13',
  end: '2026-01-31',
  patterns,
  overrides
});

module.exports = { daily_availability };