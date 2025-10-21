const { sortBy } = require('lodash');
const { DateTime } = require('luxon');

/**
 * Parses a variety of date/time formats into a Luxon DateTime object.
 * @param {*} input - The input to parse (can be DateTime, Date, number, string).
 * @returns {DateTime} - The parsed DateTime object or an invalid DateTime.
 */
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
* check if a slot is booked
* @constructor
* @param {DateTime} slotStart - start time of the slot
* @param {array} services - array of service IDs for this slot
* @param {object} bookings - all bookings
* @param {number} site_id - the ID of the site
* @returns {number|boolean} - booking ID if booked, false if not
*/
function isSlotBooked(slotStart, services, bookings, site_id = 1) {
  
  //return booking object if any booking has the same start time, site_id and at least one matching service
  for (let id in bookings) {

    if (bookings[id].site_id !== site_id) continue;
    if (!services.includes(bookings[id].service)) continue;

    const bookingStart = parseDatetime(bookings[id].datetime);
    if (slotStart.diff(bookingStart).milliseconds !== 0) continue;
    return Number(id);
  }
  return false;
}

/**
* get all slots and bookings for a single day
* @constructor
* @param {object} single_day_availability - availability for a single day
* @param {object} bookings - every booking
* @param {number} site_id - the ID of the site
* @param {string} sortBy - how to sort the slots (default: 'datetime')
* @returns {object|boolean} - slots object with counts, or false if no availability
*/
function slotsForDay(single_day_availability, bookings, site_id, sortBy = 'datetime') {

  //if there is no availability object for this day, return false
  if(!single_day_availability) return false;

  //filter bookings that match site_id
  const bookingsForSite = Object.values(bookings).filter(b => b.site_id === site_id);

  //start contracting the slots object
  const slots = [];
  const counts = {
    scheduledCount: 0,
    cancelledCount: 0,
    orphanedCount: 0,
    totalSlots: 0,
    countsPerService: []
  }

  //hold booking IDs already processed
  const processedBookingIds = [];

  //convert each session for today into a slots object
  for(const session of single_day_availability.sessions) {

  
    //calculate minutes between start and end of this session
    const [startHour, startMinute] = session.from.split(':').map(n => parseInt(n, 10));
    const [endHour, endMinute] = session.until.split(':').map(n => parseInt(n, 10));

    const date = DateTime.fromISO(single_day_availability.date);
    const startDateTime = date.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
    const endDateTime = date.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

    const totalMins = endDateTime.diff(startDateTime, 'minutes').minutes;
    const step = parseInt(session.slotLength, 10) || 10;
    const totalSlots = Math.floor(totalMins / step);

    console.log('total Slots', totalSlots);

    //build each slot
    for (let i = 0; i < totalSlots; i++) {

      const slotStart = startDateTime.plus({ minutes: i * step });
      const slotEnd = slotStart.plus({ minutes: step });

      //check if this slot is booked
      const appointment_id = isSlotBooked(slotStart, session.services, bookings, site_id);
      if (appointment_id !== false && !processedBookingIds.includes(appointment_id)) {
        processedBookingIds.push(appointment_id);
        if (appointment_id !== false && bookings[appointment_id].status === 'scheduled') counts.scheduledCount++;
        if (appointment_id !== false && bookings[appointment_id].status === 'cancelled') counts.cancelledCount++;
        if (appointment_id !== false && bookings[appointment_id].status === 'orphaned') counts.orphanedCount++;
      }
      

      //calculate counts per service
      for (const service of session.services) {
        //find or create service count object
        let serviceCount = counts.countsPerService.find(c => c.service === service);
        if (!serviceCount) {
          serviceCount = { service: service, scheduledCount: 0, cancelledCount: 0, orphanedCount: 0, totalServicesSlots: 0 };
          counts.countsPerService.push(serviceCount);
        }
        //update counts
        if (appointment_id !== false && bookings[appointment_id].service === service && !processedBookingIds.includes(appointment_id)) {
          if (bookings[appointment_id].status === 'scheduled') serviceCount.scheduledCount++;
          if (bookings[appointment_id].status === 'cancelled') serviceCount.cancelledCount++;
          if (bookings[appointment_id].status === 'orphaned') serviceCount.orphanedCount++;
        }
        serviceCount.totalServicesSlots++;
      }

      //add slot to slots array
      slots.push({
        from: slotStart,
        until: slotEnd,
        service: session.services,
        capacity: session.capacity,
        appointment_id: processedBookingIds.includes(appointment_id) ? appointment_id : false
      })
    }

    //update total slots count
    counts.totalSlots = counts.totalSlots + totalSlots;

  }

  

  //order slots by date ascending
  if (sortBy === 'datetime') {
    slots.sort((a, b) => a.from - b.from);
  }
  if (sortBy === 'service') {
    slots.sort((a, b) => {
      if (a.service[0] < b.service[0]) return -1;
      if (a.service[0] > b.service[0]) return 1;
      return 0;
    });
  }

  return {
    ...counts,
    slots
  }

}

module.exports = {slotsForDay};