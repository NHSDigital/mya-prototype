const { DateTime } = require('luxon');

function generateSlots(daily_availability, timezone = 'Europe/London') {
  const slots = [];
  Object.values(daily_availability).forEach(day => {
    const date = day.date;
    day.sessions.forEach(session => {
      const start = DateTime.fromISO(`${date}T${session.from}`, { zone: timezone });
      const end = DateTime.fromISO(`${date}T${session.until}`, { zone: timezone });
      const slotLength = session.slotLength || 10;

      for (let dt = start; dt < end; dt = dt.plus({ minutes: slotLength })) {
        slots.push(dt.toISO({ suppressSeconds: true, suppressMilliseconds: true }));
      }
    });
  });
  return slots;
}

module.exports = generateSlots;
