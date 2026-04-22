const {
  buildCancelledBookingsSummary,
  hasNotificationContact
} = require('../../app/helpers/cancelledBookingsSummary')

test('hasNotificationContact only counts mobile or email as notification channels', () => {
  expect(hasNotificationContact({ contact: { phone: '07123456789' } })).toBe(true)
  expect(hasNotificationContact({ contact: { email: 'person@example.com' } })).toBe(true)
  expect(hasNotificationContact({ contact: { landline: '01234 567890' } })).toBe(false)
  expect(hasNotificationContact({ contact: {} })).toBe(false)
})

test('buildCancelledBookingsSummary returns unnotified people for cancelled bookings', () => {
  const summary = buildCancelledBookingsSummary({
    siteBookings: {
      1: {
        id: 1,
        name: 'Alex Example',
        datetime: '2026-04-28T11:00+01:00',
        service: 'COVID:18+',
        nhsNumber: '40000000001',
        contact: {}
      },
      2: {
        id: 2,
        name: 'Taylor Example',
        datetime: '2026-04-28T11:20+01:00',
        service: 'RSV:Adult',
        nhsNumber: '40000000002',
        contact: {
          phone: '07123456789'
        }
      },
      3: {
        id: 3,
        name: 'Jordan Example',
        datetime: '2026-04-28T11:40+01:00',
        service: 'FLU:65+',
        nhsNumber: '40000000003',
        contact: {
          landline: '01234 567890'
        }
      }
    },
    affectedBookingIds: ['1', '2', '3'],
    servicesById: {
      'COVID:18+': { name: 'COVID 18+' },
      'RSV:Adult': { name: 'RSV Adult' },
      'FLU:65+': { name: 'Flu 65+' }
    }
  })

  expect(summary.cancelledCount).toBe(3)
  expect(summary.unnotifiedCount).toBe(2)
  expect(summary.unnotifiedBookings).toEqual([
    expect.objectContaining({
      id: 1,
      name: 'Alex Example',
      serviceName: 'COVID 18+'
    }),
    expect.objectContaining({
      id: 3,
      name: 'Jordan Example',
      serviceName: 'Flu 65+'
    })
  ])
})
