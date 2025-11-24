// app/data/site1.config.js
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
    capacity: 2
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
  start: '2025-10-22',
  end: '2026-01-31',
  patterns: {
    Monday: baseSessions,
    Tuesday: baseSessions,
    Wednesday: baseSessions,
    Thursday: baseSessions,
    Friday: baseSessions
  },
  overrides: {
    '2025-12-18': [   // Random day where slots are longer
      { 
        from: '10:00', 
        until: '17:00', 
        services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'], 
        slotLength: 20, 
        capacity: 1
      }
    ],
    '2025-12-15': [   // A random only-for-65s day
      { 
        from: '10:00', 
        until: '17:00', 
        services: ['FLU:65+'], 
        slotLength: 5, 
        capacity: 1
      }
    ],
    '2025-12-20': [  // Random day where slots are longer
      { 
        from: '10:00', 
        until: '17:00', 
        services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'], 
        slotLength: 15, 
        capacity: 1
      }
    ],
    '2025-12-21': [  // Random day where slots are longer
      { 
        from: '10:00', 
        until: '17:00', 
        services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'COVID_FLU:18-64', 'COVID_FLU:65+'], 
        slotLength: 20, 
        capacity: 1
      }
    ],
    '2025-12-25': [], // Christmas Day closed
    '2025-12-26': []  // Boxing Day closed
  },

  // ---- Bookings generation ----
  bookings: {
    services: ['COVID:18+', 'FLU:18-64', 'FLU:65+', 'RSV:Adult'],
    statuses: ['scheduled', 'cancelled', 'orphaned'],
    fillRate: 1,
    fillRatesByStatus: { scheduled: 0.99, cancelled: 0.01, orphaned: 0 }
  }
};
