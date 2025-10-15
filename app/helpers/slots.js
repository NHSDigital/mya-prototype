const { DateTime } = require('luxon');

// --- helpers ---
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

function isSlotBooked(slotStart, slotEnd, bookings, services, site_id = 1) {

  //calculate if a slot is booked based on existing bookings
  return bookings.some(booking => {
    if (booking.site_id !== site_id) return false; //different site

    const bookingStart = DateTime.fromISO(booking.datetime);
    console.log('bookingStart', bookingStart, 'slotStart', slotStart, 'match?', bookingStart.equals(slotStart));

    //check if booking is for the same service
    if (!services.includes(booking.service)) return false;

    //check if booking overlaps with slot
    return bookingStart.equals(slotStart)
  });

}

function getSlotsForDate(availability, bookings, date, site_id = 1) {
  date = parseDatetime(date);

  //filter availability for this site
  const siteAvailability = availability.filter(a => a.site_id === site_id);

  //build slots for this date
  const slots = [];
  siteAvailability.forEach(availability => {
    //check if this availability applies to this date
    const startDate = DateTime.fromISO(availability.startDate);
    const endDate = DateTime.fromISO(availability.endDate);
    if (date < startDate || date > endDate) return; //not in range
    if(startDate !== endDate) { //not a single date
      if (!availability.days.includes(date.toFormat('cccc'))) return; //day of week not included
    }
    
    //work out how many mins between start and end time
    const [startHour, startMinute] = availability.startTime.split(':').map(n => parseInt(n, 10));
    const [endHour, endMinute] = availability.endTime.split(':').map(n => parseInt(n, 10));
    
    const startDateTime = date.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
    const endDateTime = date.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });
    
    const totalMins = endDateTime.diff(startDateTime, 'minutes').minutes;
    const step = parseInt(availability.duration, 10) || 10;
    const totalSlots = Math.floor(totalMins / step);

    //build each slot
    for (let i = 0; i < totalSlots; i++) {
      const slotStart = startDateTime.plus({ minutes: i * step });
      const slotEnd = slotStart.plus({ minutes: step });

      const bookingInfo = false;
      const isBooked = isSlotBooked(slotStart, slotEnd, bookings, availability.services, site_id);

      slots.push({
        start: slotStart,
        end: slotEnd,
        onTheHour: slotStart.minute === 0,
        services: availability.services,
        capacity: availability.capacity,
        booked: isSlotBooked(slotStart, slotEnd, bookings, availability.services, site_id)
      });
    }

  });

  return slots;
}

module.exports = { getSlotsForDate };