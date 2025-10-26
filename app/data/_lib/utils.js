// /availability/lib/utils.js
function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// /bookings/lib/utils.js
function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomNhsNumber() {
  return String(Math.floor(40000000000 + Math.random() * 49999999999));
}

function randomDob() {
  const start = new Date(1940, 0, 1);
  const end = new Date(2022, 0, 1);
  const dob = new Date(start.getTime() + Math.random() * (end - start));
  return dob.toISOString().split('T')[0];
}

function randomContact() {
  const chance = Math.random();
  const phone = `07${Math.floor(100000000 + Math.random() * 899999999)}`;
  const landline = `01903 ${Math.floor(100000 + Math.random() * 899999)}`;
  const email = `${Math.random().toString(36).substring(2,7)}@example.com`;

  if (chance < 0.3) return { phone };
  if (chance < 0.6) return { email };
  return { phone, email, landline };
}


module.exports = { clone, randomItem, randomNhsNumber, randomDob, randomContact };
