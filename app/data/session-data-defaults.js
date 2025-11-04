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
          text: 'example.user@nhs.net',
          icon: true
        },
        {
          text: 'Log out',
          href: '/login'
        }
      ],
      site: [
        {
          text: 'example.user@nhs.net',
          icon: true
        },
        {
          text: 'Change site',
          href: '/sites'
        },
        {
          text: 'Log out',
          href: '/login'
        }
      ]
    }
   },
  navigation: { 
    overview: [
      {
        text: 'Reports',
        href: '#'
      }
    ],
    site: [
      {
        text: 'View availability',
        description: 'View availability and manage appointments for your site',
        hrefTemplate: '/site/:id/view-availability'
      },
      {
        text: 'Create availability',
        hrefTemplate: '/site/:id/create-availability'
      },
      {
        text: 'Change site details',
        description: 'Change site details and accessibility information',
        href: '#'
      },
      {
        text: 'Manage users',
        href: '#'
      },
      {
        text: 'Reports',
        description: 'Download reports',
        href: '#'
      }
    ],
    siteAvailabilityGroups: [
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
  services: {
    'COVID:5-11': {
      id: 'COVID:5-11',
      name: 'COVID 5-11',
      vaccine: 'COVID-19',
      cohort: {
        age: '5-11',
        type: 'Child'
      }
    },
    'COVID:12-17': {
      id: 'COVID:12-17',
      name: 'COVID 12-17',
      vaccine: 'COVID-19',
      cohort: {
        age: '12-17',
        type: 'Child'
      }
    },
    'COVID:18+': {
      id: 'COVID:18+',
      name: 'COVID 18+',
      vaccine: 'COVID-19',
      cohort: {
        age: '18+',
        type: 'Adult'
      }
    },
    'FLU:2-3': {
      id: 'FLU:2-3',
      name: 'Flu 2-3',
      vaccine: 'Flu',
      cohort: {
        age: '2-3',
        type: 'Child'
      }
    },
    'FLU:18-64': {
      id: 'FLU:18-64',
      name: 'Flu 18-64',
      vaccine: 'Flu',
      cohort: {
        age: '18-64',
        type: 'Adult'
      }
    },
    'FLU:65+': {
      id: 'FLU:65+',
      name: 'Flu 65+',
      vaccine: 'Flu',
      cohort: {
        age: '65+',
        type: 'Adult'
      }
    },
    'COVID_FLU:18-64': {
      id: 'COVID_FLU:18-64',
      name: 'COVID & Flu 18-64',
      vaccine: 'COVID-19 & Flu',
      cohort: {
        age: '18-64',
        type: 'Adult'
      }
    },
    'COVID_FLU:65+': {
      id: 'COVID_FLU:65+',
      name: 'COVID & Flu 65+',
      vaccine: 'COVID-19 & Flu',
      cohort: {
        age: '65+',
        type: 'Adult'
      }
    },
    'RSV:Adult': {
      id: 'RSV:Adult',
      name: 'RSV Adult',
      vaccine: 'RSV',
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
