module.exports = {
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
  sites: {
    1: {
      status_id: 'online',
      name: 'Dean’s Pharmacy',
      id: 1,
      address: [
        '123 Fake Street',
        'Faketown',
        'FK1 2AB'
      ],
      phone: '01234 567890',
      ods: 'A12345',
      icb: 'South East London Integrated Care Board',
      region: 'London'
    },
    2: {
      status_id: 'online',
      name: 'Kariissons North Road',
      id: 1,
      address: [
        '88 North Road',
        'Brighton',
        'B1 2AX'
      ],
      phone: '01234 567890',
      ods: 'A982738',
      icb: 'East Sussex ICB',
      region: 'Sussex'
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
  daily_availability: require('./daily_availability'),
  bookings: {
    1: {
      site_id: 1,
      service: 'COVID:18+',
      datetime: '2025-10-20T09:10',
      name: 'Kenny Carpets',
      nhsNumber: '49000000076',
      dob: '1986-04-19',
      contact: {
        phone: '07890 717189',
        email: 'carpets@hotmail.com',
        landline: '01903 987521'
      },
      status: 'scheduled'
    }, 
    2: {
      site_id: 2,
      service: 'COVID:5-11',
      datetime: '2025-10-20T09:20',
      name: 'Ken Tussle',
      nhsNumber: '89872903945',
      dob: '2019-10-01',
      contact: {
        phone: '07890 717189',
        email: 'tusslewithkenny19@gmail.com',
        landline: '01903 987521'
      },
      status: 'scheduled'
    }, 
    3: {
      site_id: 1,
      service: 'FLU:65+',
      datetime: '2025-10-20T10:20',
      name: 'Ken Lump',
      nhsNumber: '82937485038',
      dob: '1958-03-20',
      contact: {
        phone: '07890 8378476'
      },
      status: 'cancelled'
    },
    4: {
      site_id: 1,
      service: 'FLU:18-64',
      datetime: '2025-10-20T11:30',
      name: 'Mary Downbyyourside',
      nhsNumber: '9273048279',
      dob: '1993-04-11',
      contact: {
        email: 'mazza1993@gcloud.net'
      },
      status: 'orphaned'
    },
    5: {
      site_id: 1,
      service: 'FLU:18-64',
      datetime: '2025-10-20T11:40',
      name: 'Ron Paving',
      nhsNumber: '8263997304',
      dob: '1996-09-24',
      contact: {
        phone: '07838 9478923'
      },
      status: 'orphaned'
    },
    6: {
      site_id: 1,
      service: 'RSV:Adult',
      datetime: '2025-10-20T12:20',
      name: 'Angela Ding-Dong',
      nhsNumber: '9238475623',
      dob: '1988-12-01',
      contact: {
        phone: '07900 123456'
      },
      status: 'scheduled'
    }
  }
}