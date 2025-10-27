const { DateTime } = require('luxon');
const { randomItem, randomNhsNumber, randomDob, randomContact } = require('./utils');

function pickName(usedNames, names) {
  if (!Array.isArray(names) || names.length === 0) return `Unnamed Patient ${usedNames.size + 1}`;
  if (usedNames.size >= names.length) usedNames.clear(); // recycle names

  let attempts = 0, name;
  do {
    name = names[Math.floor(Math.random() * names.length)];
    if (++attempts > 1000) { name = `Fallback Name ${usedNames.size + 1}`; break; }
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

  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('generateBookings(): invalid names array');
  }

  const bookings = {};
  let id = 1;
  const usedNames = new Set();


  for (const slotISO of slots) {
    if (Math.random() > fillRate) continue;
    const dt = DateTime.fromISO(slotISO, { zone: timezone });

    const service = randomItem(services);

    // weighted status
    const r = Math.random();
    let status;
    if (r < fillRatesByStatus.scheduled) status = 'scheduled';
    else if (r < fillRatesByStatus.scheduled + fillRatesByStatus.cancelled) status = 'cancelled';
    else status = 'orphaned';

    const name = pickName(usedNames, names);

    bookings[id++] = {
      site_id,
      service: service,
      datetime: dt.toISO({ suppressSeconds: true, suppressMilliseconds: true }),
      name: name,
      nhsNumber: randomNhsNumber(),
      dob: randomDob(service),
      contact: randomContact(name),
      status
    };
  }

  return bookings;
}

module.exports = generateBookings;
