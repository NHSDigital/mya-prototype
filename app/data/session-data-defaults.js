const fs = require('fs');
const path = require('path');
const generateAvailability = require('./_lib/generateAvailability');
const generateSlots = require('./_lib/generateSlots');
const generateBookings = require('./_lib/generateBookings');
const catNames = require('./_lib/catNames'); //stupid cat names. We might want to change this later

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
        text: 'Home',
        hideCard: true,
        hrefTemplate: '/site/:id'
      },
      {
        text: 'Availability',
        description: 'View and manage available appointments for your site',
        hrefTemplate: '/site/:id/availability/day'
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
  serviceGroups: {
    'FLU': {
      id: 'FLU',
      title: 'Flu services'
    },
    'COVID': {
      id: 'COVID',
      title: 'COVID-19 services'
    },
    'FLU_AND_COVID': {
      id: 'FLU_AND_COVID',
      title: 'Flu and COVID-19 services'
    },
    'RSV': {
      id: 'RSV',
      title: 'RSV services'
    },
    'RSV_AND_COVID': {
      id: 'RSV_AND_COVID',
      title: 'RSV and COVID-19 services'
    }
  },
  services: {
    'COVID:5-11': {
      id: 'COVID:5-11',
      name: 'COVID 5-11',
      vaccine: 'COVID-19',
      group: 'COVID',
      cohort: {
        age: '5-11',
        type: 'Child'
      }
    },
    'COVID:12-17': {
      id: 'COVID:12-17',
      name: 'COVID 12-17',
      vaccine: 'COVID-19',
      group: 'COVID',
      cohort: {
        age: '12-17',
        type: 'Child'
      }
    },
    'COVID:18+': {
      id: 'COVID:18+',
      name: 'COVID 18+',
      vaccine: 'COVID-19',
      group: 'COVID',
      cohort: {
        age: '18+',
        type: 'Adult'
      }
    },
    'FLU:2-3': {
      id: 'FLU:2-3',
      name: 'Flu 2-3',
      vaccine: 'Flu',
      group: 'FLU',
      cohort: {
        age: '2-3',
        type: 'Child'
      }
    },
    'FLU:18-64': {
      id: 'FLU:18-64',
      name: 'Flu 18-64',
      vaccine: 'Flu',
      group: 'FLU',
      cohort: {
        age: '18-64',
        type: 'Adult'
      }
    },
    'FLU:65+': {
      id: 'FLU:65+',
      name: 'Flu 65+',
      vaccine: 'Flu',
      group: 'FLU',
      cohort: {
        age: '65+',
        type: 'Adult'
      }
    },
    'COVID_FLU:18-64': {
      id: 'COVID_FLU:18-64',
      name: 'COVID and Flu 18-64',
      vaccine: 'COVID-19 and Flu',
      group: 'FLU_AND_COVID',
      cohort: {
        age: '18-64',
        type: 'Adult'
      }
    },
    'COVID_FLU:65+': {
      id: 'COVID_FLU:65+',
      name: 'COVID and Flu 65+',
      vaccine: 'COVID-19 and Flu',
      group: 'FLU_AND_COVID',
      cohort: {
        age: '65+',
        type: 'Adult'
      }
    },
    'RSV:Adult': {
      id: 'RSV:Adult',
      name: 'RSV Adult',
      vaccine: 'RSV',
      group: 'RSV',
      cohort: {
        age: '18+',
        type: 'Adult'
      }
    },
    'RSV_COVID:12-17': {
      id: 'RSV_COVID:12-17',
      name: 'RSV and COVID 12-17',
      group: 'RSV_AND_COVID',
      vaccine: 'RSV and COVID',
      cohort: {
        age: '12-17',
        type: 'Child'
      }
    },
    'RSV_COVID:18+': {
      id: 'RSV_COVID:18+',
      name: 'RSV and COVID 18+',
      vaccine: 'RSV and COVID',
      group: 'RSV_AND_COVID',
      cohort: {
        age: '18+',
        type: 'Adult'
      }
    }
  }
}

// Import all sites
const sitesConfig = fs.readdirSync(__dirname)
  .filter(f => /^site\d+\.config\.js$/.test(f))
  .map(f => require(path.join(__dirname, f)));

const daily_availability = {};
const bookings = {};
const sites = {};

for (const cfg of sitesConfig) {
  const { site, start, end, patterns, overrides, bookings: bookingConfig } = cfg;
  const site_id = site.id;

  console.log(`\n=== Starting site ${site_id}: ${site.name} ===`);

  console.log('  1️⃣ Generating availability...');
  const availability = generateAvailability({ site_id, start, end, patterns, overrides });
  console.log('  ✅ Availability done');

  console.log('  2️⃣ Generating slots...');
  const slots = generateSlots(availability);
  console.log(`  ✅ Slots done (${slots.length} total)`);

  console.log('  3️⃣ Generating bookings...');
  const bookingData = generateBookings({
    site_id,
    slots,
    ...bookingConfig,
    names: catNames
  });
  console.log(`  ✅ Bookings done (${Object.keys(bookingData).length})`);

  daily_availability[site_id] = availability;
  bookings[site_id] = bookingData;
  sites[site_id] = site;

  console.log(`=== Finished site ${site_id} ===`);
}


module.exports = {
  ...base,
  sites,
  daily_availability,
  bookings
};
