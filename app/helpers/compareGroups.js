const { DateTime } = require('luxon');

const sameServices = (a = [], b = []) =>
  JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

const parseTime = (input, tz = 'Europe/London') => {
  if (!input) return null;

  // Already a Luxon DateTime
  if (DateTime.isDateTime(input)) return input;

  // String input like "09:00" or "9:0"
  if (typeof input === 'string') {
    // Normalize sloppy inputs like "9:0" -> "09:00"
    const match = input.match(/^(\d{1,2}):(\d{1,2})$/);
    if (match) {
      const [ , h, m ] = match;
      const hour = String(h).padStart(2, '0');
      const minute = String(m).padStart(2, '0');
      return DateTime.fromFormat(`${hour}:${minute}`, 'HH:mm', { zone: tz });
    }
    return null;
  }

  // Object input like { hour: "9", minute: "00" }
  if (typeof input === 'object' && input.hour != null && input.minute != null) {
    const hour = Number(input.hour);
    const minute = Number(input.minute);
    if (isNaN(hour) || isNaN(minute)) return null;
    return DateTime.fromObject({ hour, minute }, { zone: tz }); // ✅ zone moved to 2nd arg
  }

  // Unsupported format
  return null;
};


function diffGroups(original, edited) {
  const diff = {};
  const fields = ['from', 'until', 'capacity', 'slotLength', 'services'];

  for (const key of fields) {
    const oldVal = original.session[key];
    const newVal = edited.session[key];

    const equal =
      key === 'services'
        ? sameServices(oldVal, newVal)
        : JSON.stringify(oldVal) === JSON.stringify(newVal);

    if (!equal) diff[key] = { before: oldVal, after: newVal };
  }

  if (JSON.stringify(original.dates) !== JSON.stringify(edited.dates)) {
    diff.dates = { before: original.dates, after: edited.dates };
  }

  return diff;
}

function getAffectedBookings(bookings, edited, tz = 'Europe/London') {
  const list = Array.isArray(bookings) //defensive for when there are no bookings
    ? bookings
    : bookings && typeof bookings === 'object'
      ? Object.values(bookings)  // ✅ convert object to array
      : [];

  const start = parseTime(edited.session.from, tz);
  const end = parseTime(edited.session.until, tz);

  if (!start?.isValid || !end?.isValid) {
    console.warn('⚠️ Invalid session times', edited.session.from, edited.session.until);
    return { affected: [], notAutoCancelled: [] };
  }

  const affected = [];

  for (const b of list) { // ✅ iterate safely
    console.log({
      ...b
    });
    if (b.status !== 'scheduled') continue;

    const dt = DateTime.fromISO(b.datetime, { zone: tz });
    const minuteOfDay = dt.hour * 60 + dt.minute;
    const newStart = start.hour * 60 + start.minute;
    const newEnd = end.hour * 60 + end.minute;

    const serviceRemoved = !edited.session.services.includes(b.service);
    const outOfRange = minuteOfDay < newStart || minuteOfDay >= newEnd;

    if (serviceRemoved || outOfRange) affected.push(b);
  }

  const notAutoCancelled = affected.filter(
    b => !b.contact?.email && !b.contact?.phone
  );

  return { affected, notAutoCancelled };
}


function compareGroups(originalGroup, editedGroup, bookings = []) {
  const differences = diffGroups(originalGroup, editedGroup);
  const changed = Object.keys(differences).length > 0;

  if (!changed) {
    return {
      changed: false,
      differences,
      counts: { totalAffected: 0, notAutoCancelled: 0 },
      affectedBookingIds: [],
      notAutoCancelledIds: []
    };
  }

  const { affected, notAutoCancelled } = getAffectedBookings(bookings, editedGroup);

  return {
    changed: true,
    differences,
    counts: {
      totalAffected: affected.length,
      notAutoCancelled: notAutoCancelled.length
    },
    affectedBookingIds: affected.map(b => b.id),
    notAutoCancelledIds: notAutoCancelled.map(b => b.id)
  };
}

module.exports = compareGroups;
