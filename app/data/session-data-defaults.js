const generateAvailability = require('./_lib/generateAvailability');
const generateSlots = require('./_lib/generateSlots');
const generateBookings = require('./_lib/generateBookings');
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
  ['COVID:5-11', 'COVID 5-11', 'COVID-19', 'COVID', '5-11', 'Child'],
  ['COVID:12-17', 'COVID 12-17', 'COVID-19', 'COVID', '12-17', 'Child'],
  ['COVID:18+', 'COVID 18+', 'COVID-19', 'COVID', '18+', 'Adult'],
  ['FLU:2-3', 'Flu 2-3', 'Flu', 'FLU', '2-3', 'Child'],
  ['FLU:18-64', 'Flu 18-64', 'Flu', 'FLU', '18-64', 'Adult'],
  ['FLU:65+', 'Flu 65+', 'Flu', 'FLU', '65+', 'Adult'],
  ['COVID_FLU:18-64', 'COVID and Flu 18-64', 'COVID-19 and Flu', 'FLU_AND_COVID', '18-64', 'Adult'],
  ['COVID_FLU:65+', 'COVID and Flu 65+', 'COVID-19 and Flu', 'FLU_AND_COVID', '65+', 'Adult'],
  ['RSV:Adult', 'RSV Adult', 'RSV', 'RSV', '18+', 'Adult'],
  ['RSV_COVID:12-17', 'RSV and COVID 12-17', 'RSV and COVID', 'RSV_AND_COVID', '12-17', 'Child'],
  ['RSV_COVID:18+', 'RSV and COVID 18+', 'RSV and COVID', 'RSV_AND_COVID', '18+', 'Adult']
];

const SERVICES = Object.fromEntries(
  serviceDefinitions.map(([id, name, vaccine, group, age, type]) => [
    id,
    {
      id,
      name,
      vaccine,
      group,
      cohort: {
        age,
        type
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
        text: 'Create availability',
        description: 'Create new availability and review recently created sessions',
        hrefTemplate: '/site/:id/create-availability'
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

for (const cfg of sitesConfig) {
  const { site, start, end, patterns, overrides, bookings: bookingConfig } = cfg;
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
}


module.exports = {
  ...base,
  sites,
  daily_availability,
  bookings
};
