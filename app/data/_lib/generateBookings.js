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


function generateBookings({ site_id, slots, services, statuses, names, fillRate = 0.8, timezone = 'Europe/London' }) {
  const bookings = {};
  let id = 1;

  if (!Array.isArray(names) || names.length === 0) {
    throw new Error('generateBookings(): invalid names array');
  }
  console.log('Slot count:', slots.length);
  console.log('Names count:', names.length);


  const usedNames = new Set();


  for (const slotISO of slots) {
    if (Math.random() > fillRate) continue;
    const dt = DateTime.fromISO(slotISO, { zone: timezone });

    bookings[id++] = {
      site_id,
      service: randomItem(services),
      datetime: dt.toISO({ suppressSeconds: true, suppressMilliseconds: true }),
      name: pickName(usedNames, names),
      nhsNumber: randomNhsNumber(),
      dob: randomDob(),
      contact: randomContact(),
      status: randomItem(statuses)
    };
  }

  return bookings;
}

module.exports = generateBookings;
