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
      name: 'COVID 5-11'
    },
    'COVID:12-17': {
      id: 'COVID:12-17',
      name: 'COVID 12-17'
    },
    'COVID:18+': {
      id: 'COVID:18+',
      name: 'COVID 18+'
    },
    'FLU:2-3': {
      id: 'FLU:2-3',
      name: 'Flu 2-3'
    },
    'FLU:18-64': {
      id: 'FLU:18-64',
      name: 'Flu 18-64'
    },
    'FLU:65+': {
      id: 'FLU:65+',
      name: 'Flu 65+'
    },
    'COVID_FLU:18-64': {
      id: 'COVID_FLU:18-64',
      name: 'COVID & Flu 18-64'
    },
    'COVID_FLU:65+': {
      id: 'COVID_FLU:65+',
      name: 'COVID & Flu 65+'
    },
    'RSV:ADULT': {
      id: 'RSV:ADULT',
      name: 'RSV Adult'
    }
  },
  availability: [
    {
      site_id: 1,
      type: 'Weekly repeating',
      services: ['COVID:5-11', 'COVID:12-17', 'COVID:18+', 'FLU:2-3', 'FLU:18-64', 'FLU:65+'],
      days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      duration: 10,
      startTime: '09:00',
      endTime: '17:00',
      capacity: 1,
      startDate: '2025-10-01',
      endDate: '2025-12-31'
    },{
      site_id: 1,
      type: 'Single date',
      services: ['FLU:65+'],
      duration: 10,
      startTime: '09:00',
      endTime: '17:00',
      capacity: 1,
      startDate: '2025-10-01',
      endDate: '2025-10-01'
    }
  ],
  bookings: [
    {
      site_id: 1,
      service: 'COVID:18+',
      datetime: '2025-10-20T09:10',
      name: 'Maureen Collingworth',
      nhsNumber: '9000000076',
      dob: '1986-04-19',
      contact: {
        phone: '07890 717189',
        email: 'collingworthy@hotmail.com',
        landline: '01903 987521'
      },
      status: 'scheduled'
    }, {
      site_id: 1,
      service: 'COVID:5-11',
      datetime: '2025-10-21T09:10',
      name: 'Jol Kirby',
      nhsNumber: '898729039',
      dob: '2019-10-01',
      contact: {
        phone: '07890 717189',
        email: 'collingworthy@hotmail.com',
        landline: '01903 987521'
      },
      status: 'scheduled'
    }
  ]
}