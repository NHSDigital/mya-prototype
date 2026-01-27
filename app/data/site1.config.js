// app/data/site1.config.js
const baseSessions = [
  {
    from: '09:30',
    until: '17:00',
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+', 'RSV:Adult'],
    slotLength: 10,
    capacity: 1
  }
];

module.exports = {
  // ---- Static site data ----
  site: {
    id: 1,
    status_id: 'online',
    name: 'Dean’s Pharmacy',
    address: [
      '123 Fake Street',
      'Faketown',
      'FK1 2AB'
    ],
    phone: '01234 567890',
    ods: 'A123458',
    icb: 'South East London Integrated Care Board',
    region: 'London'
  },

  // ---- Availability generation ----
  start: '2026-10-01',
  end: '2026-12-24',
  patterns: {
    Monday: baseSessions,
    Tuesday: baseSessions,
    Wednesday: baseSessions,
    Thursday: baseSessions,
    Friday: baseSessions
  },
  overrides: {

  },

  // ---- Bookings generation ----
  bookings: {
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'RSV:Adult'],
    statuses: ['scheduled', 'cancelled', 'orphaned'],
    fillRate: 0.001, // 0.01% of slots get booked
    fillRatesByStatus: { scheduled: 0.99, cancelled: 0.01, orphaned: 0 }
  }
};
