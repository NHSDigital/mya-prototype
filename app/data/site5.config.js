// app/data/site1.config.js
const baseSessions = [
  {
    from: '10:00',
    until: '16:00',
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    slotLength: 10,
    capacity: 1
  }
];

module.exports = {
  // ---- Static site data ----
  site: {
    status_id: 'online',
    name: 'Availability Oct AND Nov',
    id: 5,
    address: [
      '88 North Road',
      'Brighton',
      'B1 2AX'
    ],
    phone: '01234 567890',
    ods: 'A982738',
    icb: 'Test Test Test',
    region: 'West Midlands'
  },

  // ---- Availability generation ----
  start: '2025-11-01',
  end: '2025-12-31',
  patterns: {
    Monday: baseSessions,
    Tuesday: baseSessions,
    Wednesday: baseSessions,
    Thursday: baseSessions,
    Friday: baseSessions
  },
  

  // ---- Bookings generation ----
  bookings: {
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'],
    statuses: ['scheduled', 'cancelled', 'orphaned'],
    fillRate: 0,
    fillRatesByStatus: { scheduled: 0.75, cancelled: 0.20, orphaned: 0.05 }
  }
};
