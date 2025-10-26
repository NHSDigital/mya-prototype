const { DateTime } = require('luxon');

/**
 * Parse any reasonable date/time input into a Luxon DateTime.
 * Always normalised to Europe/London timezone.
 */
function parseDatetime(input) {
  if (DateTime.isDateTime(input)) return input.setZone('Europe/London');
  if (input instanceof Date) return DateTime.fromJSDate(input, { zone: 'Europe/London' });
  if (typeof input === 'number') return DateTime.fromMillis(input, { zone: 'Europe/London' });

  // Try ISO first, then plain date
  let d = DateTime.fromISO(String(input), { zone: 'Europe/London' });
  if (d.isValid) return d;
  d = DateTime.fromFormat(String(input), 'yyyy-MM-dd', { zone: 'Europe/London' });
  return d.isValid ? d : DateTime.invalid('bad-input');
}

/**
 * Check if a slot is booked.
 * Returns booking ID if booked, false if not.
 */
function isSlotBooked(slotStart, services, bookings) {
  for (let id in bookings) {
    const booking = bookings[id];
    if (!services.includes(booking.service)) continue;

    const bookingStart = parseDatetime(booking.datetime);
    if (slotStart.hasSame(bookingStart, 'minute')) {
      return Number(id);
    }
  }
  return false;
}

/**
 * Build all slots and counts for a single day's availability.
 */
function slotsForDay(single_day_availability, bookings, site_id, sortBy = 'datetime') {
  if (!single_day_availability) return false;

  const slots = [];
  const counts = {
    scheduledCount: 0,
    cancelledCount: 0,
    orphanedCount: 0,
    totalSlots: 0,
    countsPerService: []
  };

  const processedBookingIds = new Set();

  // For each session, generate slots
  for (const session of single_day_availability.sessions) {
    const [startHour, startMinute] = session.from.split(':').map(n => parseInt(n, 10));
    const [endHour, endMinute] = session.until.split(':').map(n => parseInt(n, 10));

    const date = DateTime.fromISO(single_day_availability.date, { zone: 'Europe/London' });
    const startDateTime = date.set({ hour: startHour, minute: startMinute, second: 0, millisecond: 0 });
    const endDateTime = date.set({ hour: endHour, minute: endMinute, second: 0, millisecond: 0 });

    const totalMins = endDateTime.diff(startDateTime, 'minutes').minutes;
    const step = parseInt(session.slotLength, 10) || 10;
    const totalSlots = Math.floor(totalMins / step);

    // console.log(`Session on ${single_day_availability.date}: ${totalSlots} slots`);

    for (let i = 0; i < totalSlots; i++) {
      const slotStart = startDateTime.plus({ minutes: i * step });
      const slotEnd = slotStart.plus({ minutes: step });

      const appointment_id = isSlotBooked(slotStart, session.services, bookings);
      const booking = appointment_id ? bookings[appointment_id] : null;

      if (appointment_id && !processedBookingIds.has(appointment_id)) {
        processedBookingIds.add(appointment_id);

        if (booking.status === 'scheduled') counts.scheduledCount++;
        if (booking.status === 'cancelled') counts.cancelledCount++;
        if (booking.status === 'orphaned') counts.orphanedCount++;
      }

      // Update per-service counts
      for (const service of session.services) {
        let serviceCount = counts.countsPerService.find(c => c.service === service);
        if (!serviceCount) {
          serviceCount = { service, scheduledCount: 0, cancelledCount: 0, orphanedCount: 0, totalServicesSlots: 0 };
          counts.countsPerService.push(serviceCount);
        }

        if (appointment_id && booking.service === service) {
          if (booking.status === 'scheduled') serviceCount.scheduledCount++;
          if (booking.status === 'cancelled') serviceCount.cancelledCount++;
          if (booking.status === 'orphaned') serviceCount.orphanedCount++;
        }

        serviceCount.totalServicesSlots++;
      }

      slots.push({
        from: slotStart,
        until: slotEnd,
        services: session.services,
        capacity: session.capacity,
        appointment_id: appointment_id || false,
        status: appointment_id ? booking.status : 'available'
      });
    }

    counts.totalSlots += totalSlots;
  }

  // Sort
  if (sortBy === 'datetime') {
    slots.sort((a, b) => a.from - b.from);
  } else if (sortBy === 'service') {
    slots.sort((a, b) => {
      if (a.services[0] < b.services[0]) return -1;
      if (a.services[0] > b.services[0]) return 1;
      return 0;
    });
  }

  return {
    ...counts,
    slots
  };
}

module.exports = { slotsForDay };
