// app/data/session-data.defaults.js
const fs = require('fs')
const path = require('path')

// --- 1. Define your base data ---
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
  },
  //per site data
  sites: {},
  daily_availability: {},
  bookings: {}
}

// --- 2. Deep merge helper ---
function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (
      typeof source[key] === 'object' &&
      source[key] !== null &&
      !Array.isArray(source[key])
    ) {
      if (!target[key]) target[key] = {}
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

// --- 3. Automatically load extra site folders ---
// This stays inside /app/data, so no /lib edits needed.
const dataDir = __dirname

//ignore folders
const ignore = ['_lib'];

for (const entry of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (entry.isDirectory() && !ignore.includes(`./${entry.name}`)) {
    const siteDir = path.join(dataDir, entry.name)
    const jsFiles = fs.readdirSync(siteDir).filter(f => f.endsWith('.js'))

    for (const file of jsFiles) {
      const extra = require(path.join(siteDir, file))
      deepMerge(base, extra)
    }
  }
}

// --- 4. Export the merged result ---
module.exports = base