// app/data/site1.config.js
const { DateTime } = require('luxon');

const today = DateTime.now().startOf('day');
const rollingStart = today.minus({ days: 14 }).toISODate();
const rollingEnd = today.plus({ months: 3 }).toISODate();

const pastSeriesStart = today.minus({ months: 4 }).toISODate();
const pastSeriesEnd = today.minus({ months: 2 }).toISODate();
const pastSingleDate = today.minus({ days: 45 }).toISODate();

const SERVICE_IDS = {
  COVID_ADULT: 'COVID:18+',
  FLU_18_64: 'FLU:18-64',
  FLU_65_PLUS: 'FLU:65+',
  COVID_FLU_18_64: 'COVID_FLU:18-64',
  COVID_FLU_65_PLUS: 'COVID_FLU:65+',
  RSV_ADULT: 'RSV:Adult'
};

const baseSessions = [
  {
    from: '09:30',
    until: '17:00',
    services: [
      SERVICE_IDS.COVID_ADULT,
      SERVICE_IDS.FLU_18_64,
      SERVICE_IDS.FLU_65_PLUS,
      SERVICE_IDS.COVID_FLU_18_64,
      SERVICE_IDS.COVID_FLU_65_PLUS,
      SERVICE_IDS.RSV_ADULT
    ],
    slotLength: 10,
    capacity: 1
  }
];

const seedClinics = [
  {
    label: 'Mon, Thu clinic series 10:00',
    startDate: pastSeriesStart,
    endDate: pastSeriesEnd,
    recurrencePattern: {
      frequency: 'Weekly',
      interval: 1,
      byDay: ['Monday', 'Thursday']
    },
    from: '10:00',
    until: '14:00',
    slotLength: 15,
    services: [SERVICE_IDS.COVID_ADULT, SERVICE_IDS.FLU_65_PLUS],
    capacity: 2,
    childSessions: [],
    closures: []
  },
  {
    label: 'Single clinic 09:00',
    startDate: pastSingleDate,
    endDate: pastSingleDate,
    recurrencePattern: {
      frequency: 'Weekly',
      interval: 1,
      byDay: ['Wednesday']
    },
    from: '09:00',
    until: '12:00',
    slotLength: 10,
    services: [SERVICE_IDS.RSV_ADULT],
    capacity: 1,
    childSessions: [],
    closures: []
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
  start: rollingStart,
  end: rollingEnd,
  patterns: {
    Monday: baseSessions,
    Tuesday: baseSessions,
    Wednesday: baseSessions,
    Thursday: baseSessions,
    Friday: baseSessions
  },
  overrides: {

  },

  // ---- Extra clinic seeds (in addition to generated defaults) ----
  seedClinics,

  // ---- Bookings generation ----
  bookings: {
    services: [
      SERVICE_IDS.COVID_ADULT,
      SERVICE_IDS.FLU_18_64,
      SERVICE_IDS.FLU_65_PLUS,
      SERVICE_IDS.RSV_ADULT
    ],
    statuses: ['scheduled', 'cancelled', 'orphaned'],
    fillRate: 0.01,
    fillRatesByStatus: { scheduled: 0.99, cancelled: 0.01, orphaned: 0 }
  }
};
