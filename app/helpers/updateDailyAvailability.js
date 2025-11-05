const { DateTime } = require('luxon');

/**
 * Add new session availability into an existing structure.
 *
 * @param {object} newSession - The session form data.
 * @param {object} existingSessions - Full availability object, shaped like { [site_id]: { [date]: {...} } }
 * @param {string|number} site_id - Site identifier.
 */
module.exports = (newSession, existingSessions = {}, site_id) => {
  newSession.startDate = DateTime.fromObject({
    day: +newSession.startDate.day,
    month: +newSession.startDate.month,
    year: +newSession.startDate.year
  }).toISODate();

  newSession.endDate = DateTime.fromObject({
    day: +newSession.endDate.day,
    month: +newSession.endDate.month,
    year: +newSession.endDate.year
  }).toISODate();

  const startDate = DateTime.fromISO(newSession.startDate);
  const endDate = DateTime.fromISO(newSession.endDate);

  console.log('Updating daily availability from', startDate.toISODate(), 'to', endDate.toISODate());

  // Get or create the site-level container
  if (!existingSessions[site_id]) existingSessions[site_id] = {};
  const siteAvailability = existingSessions[site_id];

  for (let dt = startDate; dt <= endDate; dt = dt.plus({ days: 1 })) {
    const dayName = dt.toFormat('cccc');
    if (!newSession.days.includes(dayName)) continue;

    const newSessionObject = {
      from: `${newSession.startTime.hour}:${newSession.startTime.minute}`,
      until: `${newSession.endTime.hour}:${newSession.endTime.minute}`,
      services: newSession.services,
      slotLength: newSession.duration,
      capacity: newSession.capacity
    };

    const dateKey = dt.toISODate();

    // Merge safely — append or create
    if (siteAvailability[dateKey]) {
      siteAvailability[dateKey].sessions.push(newSessionObject);
    } else {
      siteAvailability[dateKey] = {
        date: dateKey,
        site_id,
        sessions: [newSessionObject]
      };
    }
  }

  console.log('Updated availability:', JSON.stringify(existingSessions, null, 2));
  return existingSessions;
};
