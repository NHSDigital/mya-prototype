const { DateTime } = require('luxon');

function parseDatetime(input) {
  if (DateTime.isDateTime(input)) return input;

  if (input instanceof Date) return DateTime.fromJSDate(input);
  if (typeof input === "number") return DateTime.fromMillis(input);

  // Try ISO, then yyyy-MM-dd
  let d = DateTime.fromISO(String(input));
  if (d.isValid) return d;
  d = DateTime.fromFormat(String(input), "yyyy-MM-dd");
  return d.isValid ? d : DateTime.invalid("bad-input");
}

/**
* get all slots and bookings for a single day
* @constructor
* @param {object} single_day_availability - availability for a single day
* @param {object} bookings - every booking
* @param {number} site_id - the ID of the site
*/
function slotsForDay(single_day_availability, bookings, site_id) {

  //if there is no availability object for this day, return false
  if(!single_day_availability) return false;

  //filter bookings that match site_id
  const bookingsForSite = Object.values(bookings).filter(b => b.site_id === site_id);

  //start contracting the slots object
  const sessions = [];
  const counts = {
    scheduledCount: 0,
    cancelledCount: 0,
    orphanedCount: 0
  }

  //convert each session for today into a slots object
  for(const session of single_day_availability.sessions) {

    const slots = [];

    //calculate minutes between start and end of this session
    const [startHour, startMinute] = session.from.split(':').map(n => parseInt(n, 10));
    const [endHour, endMinute] = session.until.split(':').map(n => parseInt(n, 10));

    const date = DateTime.fromISO(single_day_availability.date);
    const startDateTime = date.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
    const endDateTime = date.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

    const totalMins = endDateTime.diff(startDateTime, 'minutes').minutes;
    const step = parseInt(session.slotLength, 10) || 10;
    const totalSlots = Math.floor(totalMins / step);

    //build each slot
    for (let i = 0; i < totalSlots; i++) {

      const slotStart = startDateTime.plus({ minutes: i * step });
      const slotEnd = slotStart.plus({ minutes: step });

      slots.push({
        from: slotStart,
        until: slotEnd,
        service: session.services
      })
    }

    sessions.push(slots);

  }

  return {
    ...counts,
    sessions
  }

}

module.exports = {slotsForDay};