const generateAvailability = require('./_lib/generateAvailability');
const generateSlots = require('./_lib/generateSlots');
const generateBookings = require('./_lib/generateBookings');
const { stableId } = require('./_lib/utils');
const catNames = require('./_lib/catNames');
const site1Config = require('./site1.config');

const SERVICE_GROUPS = {
  FLU: {
    id: 'FLU',
    title: 'Flu services'
  },
  COVID: {
    id: 'COVID',
    title: 'COVID-19 services'
  },
  FLU_AND_COVID: {
    id: 'FLU_AND_COVID',
    title: 'Flu and COVID-19 co-admin services'
  },
  RSV: {
    id: 'RSV',
    title: 'RSV services'
  },
  RSV_AND_COVID: {
    id: 'RSV_AND_COVID',
    title: 'RSV and COVID-19 co-admin services'
  }
};

const serviceDefinitions = [
  { id: 'COVID:5-11', name: 'COVID 5-11', vaccine: 'COVID-19', group: 'COVID', age: '5-11', type: 'Child' },
  { id: 'COVID:12-17', name: 'COVID 12-17', vaccine: 'COVID-19', group: 'COVID', age: '12-17', type: 'Child' },
  { id: 'COVID:18+', name: 'COVID 18+', vaccine: 'COVID-19', group: 'COVID', age: '18+', type: 'Adult' },
  { id: 'FLU:2-3', name: 'Flu 2-3', vaccine: 'Flu', group: 'FLU', age: '2-3', type: 'Child' },
  { id: 'FLU:18-64', name: 'Flu 18-64', vaccine: 'Flu', group: 'FLU', age: '18-64', type: 'Adult' },
  { id: 'FLU:65+', name: 'Flu 65+', vaccine: 'Flu', group: 'FLU', age: '65+', type: 'Adult' },
  { id: 'COVID_FLU:18-64', name: 'COVID and Flu 18-64', vaccine: 'COVID-19 and Flu', group: 'FLU_AND_COVID', age: '18-64', type: 'Adult' },
  { id: 'COVID_FLU:65+', name: 'COVID and Flu 65+', vaccine: 'COVID-19 and Flu', group: 'FLU_AND_COVID', age: '65+', type: 'Adult' },
  { id: 'RSV:Adult', name: 'RSV Adult', vaccine: 'RSV', group: 'RSV', age: '18+', type: 'Adult' },
  { id: 'RSV_COVID:12-17', name: 'RSV and COVID 12-17', vaccine: 'RSV and COVID', group: 'RSV_AND_COVID', age: '12-17', type: 'Child' },
  { id: 'RSV_COVID:18+', name: 'RSV and COVID 18+', vaccine: 'RSV and COVID', group: 'RSV_AND_COVID', age: '18+', type: 'Adult' }
];

const SERVICES = Object.fromEntries(
  serviceDefinitions.map((definition) => [
    definition.id,
    {
      id: definition.id,
      name: definition.name,
      vaccine: definition.vaccine,
      group: definition.group,
      cohort: {
        age: definition.age,
        type: definition.type
      }
    }
  ])
);

// --- Define base data ---
const base = {
  //global data
  user: { 
    name: 'example.user@nhs.net',
    links: {
      overview: [
        {
          text: 'user@example.com'
        },
        {
          text: 'Log out',
          href: '/login'
        }
      ],
      site: [
        {
          isSiteName: true
        },
        {
          text: 'user@example.com'
        },
        {
          text: 'Log out',
          href: '/login'
        }
      ]
    }
   },
  navigation: { 
    homepage: {
      href: '/sites'
    },
    overview: [
      {
        text: 'Reports',
        href: '#'
      }
    ],
    site: [
      {
        text: 'View availability',
        description: 'View and manage available appointments for your site',
        hrefTemplate: '/site/:id/availability/day'
      },
      {
        text: 'Manage clinics',
        description: 'Create clinics and review recently created clinic series',
        hrefTemplate: '/site/:id/clinics'
      },
      {
        text: 'Change site details',
        description: 'Change site details and accessibility information',
        href: '#'
      },
      {
        text: 'Manage users',
        description: 'Add or remove users for your site',
        href: '#'
      },
      {
        text: 'Reports',
        description: 'Download reports',
        href: '#'
      }
    ]
   },
  statuses: { 
    online: {
      text: 'Online',
      colour: 'green'
    },
    offline: {
      text: 'Offline',
      colour: 'red'
    } 
  },
  serviceGroups: SERVICE_GROUPS,
  services: SERVICES
}

// Strip-mode dataset: keep one site only.
const sitesConfig = [site1Config];

const daily_availability = {};
const bookings = {};
const sites = {};
const recurring_sessions = {};

function buildRecurringDefaults({ site_id, start, end, patterns = {} }) {
  const grouped = new Map();

  for (const [dayName, sessions] of Object.entries(patterns)) {
    for (const session of (sessions || [])) {
      const normalized = {
        from: session.from,
        until: session.until,
        slotLength: Number(session.slotLength) || 10,
        services: session.services || [],
        capacity: Number(session.capacity) || 1
      };

      const signature = JSON.stringify(normalized);
      if (!grouped.has(signature)) {
        grouped.set(signature, {
          ...normalized,
          byDay: []
        });
      }

      const bucket = grouped.get(signature);
      if (!bucket.byDay.includes(dayName)) {
        bucket.byDay.push(dayName);
      }
    }
  }

  const output = {};
  for (const record of grouped.values()) {
    const id = stableId(`${site_id}-${start}-${end}-${record.from}-${record.until}-${record.services.join('|')}-${record.capacity}-${record.slotLength}`);
    output[id] = {
      id,
      label: `${record.byDay.join(', ')} clinic series ${record.from}`,
      startDate: start,
      endDate: end,
      recurrencePattern: {
        frequency: 'Weekly',
        interval: 1,
        byDay: record.byDay
      },
      from: record.from,
      until: record.until,
      slotLength: record.slotLength,
      services: record.services,
      capacity: record.capacity,
      exclusionTimes: [],
      exclusionDateRanges: [],
      overrideDates: []
    };
  }

  return output;
}

function buildSeedRecurringDefaults(site_id, seedRecurringClinics = []) {
  const output = {};

  for (const clinic of seedRecurringClinics) {
    const stableSignature = [
      site_id,
      clinic.startDate,
      clinic.endDate,
      clinic.from,
      clinic.until,
      (clinic.services || []).join('|'),
      clinic.capacity,
      clinic.slotLength,
      ((clinic.recurrencePattern && clinic.recurrencePattern.byDay) || []).join('|')
    ].join('-');

    const id = clinic.id || stableId(stableSignature);
    output[id] = {
      id,
      label: clinic.label || `Clinic ${clinic.from || ''}`.trim(),
      startDate: clinic.startDate,
      endDate: clinic.endDate || clinic.startDate,
      recurrencePattern: clinic.recurrencePattern || {
        frequency: 'Weekly',
        interval: 1,
        byDay: []
      },
      from: clinic.from,
      until: clinic.until,
      slotLength: Number(clinic.slotLength) || 10,
      services: clinic.services || [],
      capacity: Number(clinic.capacity) || 1,
      exclusionTimes: clinic.exclusionTimes || [],
      exclusionDateRanges: clinic.exclusionDateRanges || [],
      overrideDates: clinic.overrideDates || []
    };
  }

  return output;
}

for (const cfg of sitesConfig) {
  const {
    site,
    start,
    end,
    patterns,
    overrides,
    bookings: bookingConfig,
    seedClinics,
    seedRecurringClinics = []
  } = cfg;
  const configuredSeedClinics = seedClinics || seedRecurringClinics;
  const site_id = site.id;

  const availability = generateAvailability({ site_id, start, end, patterns, overrides });

  const slots = generateSlots(availability);

  const bookingData = generateBookings({
    site_id,
    slots,
    ...bookingConfig,
    names: catNames
  });

  daily_availability[site_id] = availability;
  bookings[site_id] = bookingData;
  sites[site_id] = site;
  recurring_sessions[site_id] = {
    ...buildRecurringDefaults({ site_id, start, end, patterns }),
    ...buildSeedRecurringDefaults(site_id, configuredSeedClinics)
  };
}


module.exports = {
  ...base,
  sites,
  daily_availability,
  bookings,
  recurring_sessions
};
