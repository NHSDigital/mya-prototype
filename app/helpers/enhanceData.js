const { DateTime } = require('luxon');
const generateGroupId = require('./groupId');

/**
 * Build slot structures for each site and date.
 * - Expands all sessions into time slots.
 * - Marks which slots are booked, cancelled, etc.
 *
 * @param {Object} options.daily_availability - { [site_id]: { [date]: { sessions: [...] } } }
 * @param {Object} options.bookings - { [site_id]: { [bookingId]: bookingData } }
 * @param {String} [options.timezone='Europe/London']
 *
 * @returns {Object} { [site_id]: { [date]: [slot, slot, ...] } }
 */
function enhanceData({ daily_availability, bookings, timezone = 'Europe/London' }) {
  const slots = {};

  for (const [site_id, availability] of Object.entries(daily_availability)) {
    slots[site_id] = {};

    for (const [date, day] of Object.entries(availability)) {
      if (!day?.sessions?.length) continue;
      slots[site_id][date] = [];

      for (const session of day.sessions) {
        const start = DateTime.fromISO(`${date}T${session.from}`, { zone: timezone });
        const end = DateTime.fromISO(`${date}T${session.until}`, { zone: timezone });
        const slotLength = session.slotLength || 10;
        const capacity = session.capacity || 1;

        for (let dt = start; dt < end; dt = dt.plus({ minutes: slotLength })) {
          for (let c = 0; c < capacity; c++) {
            const datetime = dt.toISO({ suppressSeconds: true, suppressMilliseconds: true });

            // find booking for this exact datetime
            const bookingEntry = Object.entries(bookings[site_id] || {}).find(
              ([, b]) => b.datetime === datetime
            );
            const booking = bookingEntry ? bookingEntry[1] : null;

            slots[site_id][date].push({
              datetime,
              date,
              group: {
                id: generateGroupId(session),
                start: session.from,
                end: session.until
              },
              site_id,
              slotLength,
              capacity,
              capacity_index: c + 1,
              services: session.services || [],
              booked: !!booking,
              booking_id: bookingEntry ? bookingEntry[0] : null,
              booking_status: booking ? booking.status : null
            });
          }
        }
      }
    }
  }

  return slots;
}

module.exports = enhanceData;
