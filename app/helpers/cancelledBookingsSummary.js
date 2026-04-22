function asArray(value) {
  if (Array.isArray(value)) return value
  if (value === undefined || value === null || value === '') return []
  return [value]
}

function hasNotificationContact(booking = {}) {
  const phone = String(booking?.contact?.phone || '').trim()
  const email = String(booking?.contact?.email || '').trim()

  return Boolean(phone || email)
}

function buildCancelledBookingsSummary({
  siteBookings = {},
  affectedBookingIds = [],
  servicesById = {}
} = {}) {
  const cancelledBookings = asArray(affectedBookingIds)
    .map((id) => siteBookings?.[id] || siteBookings?.[String(id)] || null)
    .filter(Boolean)

  const unnotifiedBookings = cancelledBookings
    .filter((booking) => !hasNotificationContact(booking))
    .map((booking) => ({
      id: booking.id,
      name: booking.name || 'Unknown person',
      datetime: booking.datetime || '',
      nhsNumber: booking.nhsNumber || '',
      serviceId: booking.service || '',
      serviceName: servicesById?.[booking.service]?.name || booking.service || 'Unknown service',
      contact: booking.contact || {}
    }))

  return {
    cancelledCount: cancelledBookings.length,
    unnotifiedCount: unnotifiedBookings.length,
    unnotifiedBookings
  }
}

module.exports = {
  buildCancelledBookingsSummary,
  hasNotificationContact
}
