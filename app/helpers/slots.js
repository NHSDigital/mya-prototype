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

function getSlotsForDate(availability, bookings, date, site_id = 1) {
  console.log('bookings', bookings);
  date = parseDatetime(date);

  //filter availability for this site
  const siteAvailability = availability.filter(a => a.site_id === site_id);

  //build slots for this date
  const slots = [];
  let scheduledCount = 0;
  let cancelledCount = 0;
  let orphanedCount = 0;

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

      const appointment_id = isSlotBooked(slotStart, availability.services, bookings, site_id);
      if (appointment_id !== false && bookings[appointment_id].status === 'scheduled') scheduledCount++;
      if (appointment_id !== false && bookings[appointment_id].status === 'cancelled') cancelledCount++;
      if (appointment_id !== false && bookings[appointment_id].status === 'orphaned') orphanedCount++;

      slots.push({
        start: slotStart,
        end: slotEnd,
        onTheHour: slotStart.minute === 0,
        services: availability.services,
        capacity: availability.capacity,
        appointment_id: appointment_id
      });
    }

  });

  const slotObject = {
    scheduled: scheduledCount,
    cancelled: cancelledCount,
    orphaned: orphanedCount,
    total: slots.length,
    available: slots.length - scheduledCount,
    slots: slots
  }

  return slotObject;
}

module.exports = { getSlotsForDate };