const { DateTime } = require('luxon');
const generateGroupId = require('./groupId');

function bookingKeyFromISO(datetime, timezone) {
  return DateTime.fromISO(datetime, { zone: timezone }).toFormat("yyyy-MM-dd'T'HH:mm");
}

function bookingBucketKey({ slotKey, sessionId, recurringSessionId }) {
  if (sessionId) return `session:${sessionId}:${slotKey}`;
  if (recurringSessionId) return `recurring:${recurringSessionId}:${slotKey}`;
  return `time:${slotKey}`;
}

function bookingBucketKeysForSlot(slot) {
  const keys = [];

  if (slot?.sessionId && slot?.slotKey) {
    keys.push(bookingBucketKey({ slotKey: slot.slotKey, sessionId: slot.sessionId }));
  }

  if (slot?.recurringSessionId && slot?.slotKey) {
    keys.push(bookingBucketKey({ slotKey: slot.slotKey, recurringSessionId: slot.recurringSessionId }));
  }

  if (slot?.slotKey) {
    keys.push(bookingBucketKey({ slotKey: slot.slotKey }));
  }

  return keys;
}

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

  for (const [site_id, availability] of Object.entries(daily_availability || {})) {
    slots[site_id] = {};

    const bookingBuckets = new Map();
    for (const [id, b] of Object.entries(bookings?.[site_id] || {})) {
      if (!b?.datetime) continue;
      const key = bookingBucketKey({
        slotKey: b.slotKey || bookingKeyFromISO(b.datetime, timezone),
        sessionId: b.sessionId,
        recurringSessionId: b.recurringSessionId
      });
      const existing = bookingBuckets.get(key) || [];
      existing.push({ id, ...b });
      bookingBuckets.set(key, existing);
    }

    for (const [date, day] of Object.entries(availability)) {
      if (!day?.sessions?.length) continue;
      slots[site_id][date] = [];

      for (const session of day.sessions) {
        const start = DateTime.fromISO(`${date}T${session.from}`, { zone: timezone });
        const end = DateTime.fromISO(`${date}T${session.until}`, { zone: timezone });
        const slotLength = session.slotLength || 10;
        const capacity = session.capacity || 1;

        for (let dt = start; dt < end; dt = dt.plus({ minutes: slotLength })) {
          const slotKey = dt.toFormat("yyyy-MM-dd'T'HH:mm");

          for (let c = 0; c < capacity; c++) {
            const datetime = dt.toISO({ suppressSeconds: true, suppressMilliseconds: true });
            const slotDescriptor = {
              slotKey,
              sessionId: session.id || null,
              recurringSessionId: session.recurringId || null
            };

            let booking = null;
            for (const bucketKey of bookingBucketKeysForSlot(slotDescriptor)) {
              const bucket = bookingBuckets.get(bucketKey) || [];
              if (bucket.length > 0) {
                booking = bucket.shift();
                break;
              }
            }

            slots[site_id][date].push({
              datetime,
              slotKey,
              date,
              group: {
                id: generateGroupId(session),
                start: session.from,
                end: session.until
              },
              sessionId: session.id || null,
              recurringSessionId: session.recurringId || null,
              site_id,
              slotLength,
              capacity,
              capacity_index: c + 1,
              services: session.services || [],
              booked: !!booking,
              booking_id: booking ? booking.id : null,
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
