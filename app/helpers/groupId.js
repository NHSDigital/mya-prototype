const crypto = require('crypto');

function generateGroupId(session) {
  const key = JSON.stringify({
    from: session.from,
    until: session.until,
    slotLength: session.slotLength,
    capacity: session.capacity,
    services: [...session.services].sort(),
  });
  // Generate a short, stable hash
  return crypto.createHash('md5').update(key).digest('hex').slice(0, 10);
}

module.exports = generateGroupId;