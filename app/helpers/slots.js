// ./app/data/_lib/generateSlots.js
const { DateTime } = require('luxon');
const crypto = require('crypto');

/**
 * Create a stable ID for a session pattern.
 * Used to tag all slots belonging to the same session.
 */
function sessionId(session) {
  const str = [
    session.from,
    session.until,
    session.slotLength,
    session.capacity,
    (session.services || []).join('|')
  ].join('-');
  return crypto.createHash('md5').update(str).digest('hex').slice(0, 10);
}

/**
 * Generate all time slots for every session in the daily availability data.
 *
 * @param {Object} daily_availability - Output from generateAvailability()
 * @param {String} timezone - e.g. 'Europe/London'
 * @returns {Object} Slots grouped by date
 */
function generateSlots(daily_availability, timezone = 'Europe/London') {
  const slots = {}; // keyed by date

  for (const day of Object.values(daily_availability)) {
    const date = day.date;
    if (!Array.isArray(day.sessions)) continue;

    for (const session of day.sessions) {
      const id = sessionId(session);
      const start = DateTime.fromISO(`${date}T${session.from}`, { zone: timezone });
      const end = DateTime.fromISO(`${date}T${session.until}`, { zone: timezone });
      const slotLength = session.slotLength || 10;
      const capacity = session.capacity || 1;

      for (let dt = start; dt < end; dt = dt.plus({ minutes: slotLength })) {
        for (let c = 0; c < capacity; c++) {
          const slot = {
            datetime: dt.toISO({ suppressSeconds: true, suppressMilliseconds: true }),
            date,
            from: session.from,
            until: session.until,
            services: session.services || [],
            slotLength,
            capacity,
            capacity_index: c + 1,
            session_id: id
          };

          // push into date group
          if (!slots[date]) slots[date] = [];
          slots[date].push(slot);
        }
      }
    }
  }

  return slots;
}

module.exports = generateSlots;
