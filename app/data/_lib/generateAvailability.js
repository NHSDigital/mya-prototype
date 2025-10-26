// /availability/lib/utils.js
function formatDate(d) {
  return d.toISOString().split('T')[0];
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}


/**
 * Generates a daily_availability object.
 * @param {Object} config - Site config
 * @param {number} config.site_id
 * @param {string} config.start - ISO date string
 * @param {string} config.end - ISO date string
 * @param {Object} config.patterns - e.g. { Monday: [session1, session2], Sunday: [...] }
 * @param {Object} [config.overrides] - e.g. { '2025-12-25': [] } or custom sessions
 * @returns {Object} daily_availability
 */
function generateAvailability({ site_id, start, end, patterns, overrides = {} }) {
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const daily_availability = {};

  const startDate = new Date(start);
  const endDate = new Date(end);

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayName = weekdays[d.getDay()];
    const dateStr = formatDate(d);

    // 1: If override exists for this date, use it
    if (overrides[dateStr] !== undefined) {
      daily_availability[dateStr] = {
        date: dateStr,
        site_id,
        sessions: clone(overrides[dateStr]),
      };
      continue;
    }

    // 2️⃣ If there's a weekly pattern for this day, apply it
    if (patterns[dayName]) {
      daily_availability[dateStr] = {
        date: dateStr,
        site_id,
        sessions: clone(patterns[dayName]),
      };
    }
  }

  return {[site_id]: { ...daily_availability }};
}

module.exports = generateAvailability;
