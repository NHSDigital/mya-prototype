const { DateTime } = require('luxon');
const { randomItem, randomNhsNumber, randomDob, randomContact } = require('./utils');

function pickName(usedNames, names) {
  if (!Array.isArray(names) || names.length === 0) {
    return `Unnamed Patient ${usedNames.size + 1}`;
  }

  // Recycle once all names are used
  if (usedNames.size >= names.length) {
    usedNames.clear();
  }

  let name;
  let attempts = 0;
  do {
    name = names[Math.floor(Math.random() * names.length)];
    attempts++;
    if (attempts > 1000) {
      // fail-safe break to avoid infinite loop
      name = `Fallback ${usedNames.size + 1}`;
      break;
    }
  } while (usedNames.has(name));

  usedNames.add(name);
  return name;
}


function generateBookings({
  site_id,
  slots,
  services,
  statuses,
  names,
  fillRate = 0.8,
  fillRatesByStatus = { scheduled: 0.7, cancelled: 0.2, orphaned: 0.1 },
  timezone = 'Europe/London'
}) {
  const bookings = {};
  let id = 1;
  const usedNames = new Set();

  console.log('    → generateBookings: received', slots.length, 'slots')
  let processed = 0;

  for (const slot of slots) {
    if (++processed % 500 === 0) console.log('      processed', processed, 'slots');
    if (Math.random() > fillRate) continue;

    // Support both plain ISO strings and objects
    const dtISO = typeof slot === 'string' ? slot : slot.datetimeISO;
    const dt = DateTime.fromISO(dtISO, { zone: timezone });
    if (!dt.isValid) {
      console.warn('⚠️ invalid date', dtISO);
      continue;
    }

    const allowedServices =
      (slot.services && slot.services.length > 0 ? slot.services : services) || [];

    if (allowedServices.length === 0) {
      console.warn('⚠️ no services for slot', dtISO);
      continue;
    }

    const service = randomItem(allowedServices);
    if (!service) {
      console.warn('⚠️ failed to pick service', allowedServices);
      continue;
    }

    const r = Math.random();
    let status;
    if (r < fillRatesByStatus.scheduled) status = 'scheduled';
    else if (r < fillRatesByStatus.scheduled + fillRatesByStatus.cancelled) status = 'cancelled';
    else status = 'orphaned';

    const name = pickName(usedNames, names);

    bookings[id] = {
      id,
      site_id,
      service,
      datetime: dt.toISO({ suppressSeconds: true, suppressMilliseconds: true }),
      name,
      nhsNumber: randomNhsNumber(),
      dob: randomDob(service),
      contact: randomContact(name),
      status
    };
    id++;
  }
  console.log('    → finished generateBookings', Object.keys(bookings).length);
  return bookings;
}

module.exports = generateBookings;
