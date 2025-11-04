const { DateTime } = require('luxon');

function generateSlots(availability) {
  const slots = [];
  const tz = 'Europe/London';

  for (const [date, day] of Object.entries(availability)) {
    if (!day.sessions || day.sessions.length === 0) continue;

    for (const session of day.sessions) {
      const slotLength = Number(session.slotLength) || 10;
      const capacity = Number(session.capacity) || 1;

      const dayDate = DateTime.fromISO(date, { zone: tz });
      const start = DateTime.fromFormat(session.from, 'HH:mm', { zone: tz }).set({
        year: dayDate.year,
        month: dayDate.month,
        day: dayDate.day
      });
      const end = DateTime.fromFormat(session.until, 'HH:mm', { zone: tz }).set({
        year: dayDate.year,
        month: dayDate.month,
        day: dayDate.day
      });

      // 🛑 Guard against inverted or missing times
      if (!start.isValid || !end.isValid || end <= start) {
        console.warn(
          `⚠️ Invalid or zero-length session on ${date} (${session.from}–${session.until})`
        );
        continue;
      }

      let cursor = start;
      const maxIterations = 1440 / slotLength + 5; // never loop > 24h worth of slots
      let count = 0;

      while (cursor < end && count < maxIterations) {
        for (let i = 0; i < capacity; i++) {
          slots.push({
            datetimeISO: cursor.toISO({ suppressSeconds: true, suppressMilliseconds: true }),
            services: session.services || [],
            site_id: day.site_id
          });
        }
        cursor = cursor.plus({ minutes: slotLength });
        count++;
      }

      if (count >= maxIterations) {
        console.error(`❌ Session loop safety triggered on ${date} ${session.from}–${session.until}`);
      }
    }
  }

  return slots;
}

module.exports = generateSlots;
