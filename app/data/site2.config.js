// app/data/site1.config.js
const baseSessions = [
  {
    from: '10:00',
    until: '17:00',
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    slotLength: 5,
    capacity: 1
  }
];

module.exports = {
  // ---- Static site data ----
  site: {
    status_id: 'online',
    name: 'Kariissons North Road',
    id: 2,
    address: [
      '88 North Road',
      'Brighton',
      'B1 2AX'
    ],
    phone: '01234 567890',
    ods: 'A982738',
    icb: 'East Sussex ICB',
    region: 'Sussex'
  },

  // ---- Availability generation ----
  start: '2025-10-01',
  end: '2026-01-31',
  patterns: {
    Monday: baseSessions,
    Tuesday: baseSessions,
    Wednesday: baseSessions,
    Thursday: baseSessions,
    Friday: baseSessions
  },
  overrides: {
    '2025-11-18': [
      { from: '12:00', until: '16:00', services: ['COVID:18+'], slotLength: 10, capacity: 20 }
    ], //a test day in the past
    '2025-12-25': [], // Christmas Day closed
    '2025-12-26': [],  // Boxing Day closed
    '2026-01-01': [   // New Year's Day reduced hours
      { from: '10:00', until: '13:00', services: ['FLU:18-64'], slotLength: 20, capacity: 1 }
    ],
    '2025-12-27': [   // Additional clinic
      { from: '10:00', until: '13:00', services: ['FLU:18-64'], slotLength: 10, capacity: 1 }
    ]
  },

  // ---- Bookings generation ----
  bookings: {
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    statuses: ['scheduled', 'cancelled', 'orphaned'],
    fillRate: 0.1,
    fillRatesByStatus: { scheduled: 0.75, cancelled: 0.20, orphaned: 0.05 }
  }
};
