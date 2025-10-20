const { DateTime } = require("luxon");

/**
 * Get all weeks covering a given month.
 *
 * @param {number} year  - e.g. 2025
 * @param {number} month - 1–12
 * @param {number} weekStart - Weekday number (1=Monday, 7=Sunday)
 * @returns {Array<{ start: DateTime, end: DateTime, days: Array }>}
 */
const weeksInMonth = (month, year, weekStart = 1) => {
  const start = DateTime.local(year, month, 1);
  const end = start.endOf("month");

  // align to chosen start of week
  let cursor = start.startOf("week").set({ weekday: weekStart });

  if (cursor > start) {
    cursor = cursor.minus({ weeks: 1 });
  }

  const weeks = [];

  // step week-by-week until we've passed the end of the month
  while (cursor <= end) {
    weeks.push({
      start: cursor,
      end: cursor.endOf("week"),
      days: []
    });
    cursor = cursor.plus({ weeks: 1 });
  }

  // fill in the days for each week
  weeks.forEach(week => {
    week.days = [];
    for (let d = week.start; d <= week.end; d = d.plus({ days: 1 })) {
      week.days.push(d);
    }
  });

  return weeks;
}

/**
 * Return all days in the week containing the given date.
 *
 * @param {string} date - ISO date string
 * @param {number} weekStart - Weekday number (1=Monday, 7=Sunday), default 1 (Monday)
 * @returns {Array<DateTime>}
 */
const daysInWeek = (date) => {
  const dt = DateTime.fromISO(date);
  const weekStart = dt.startOf("week").set({ weekday: 1 }); // Monday
  const days = [];
  for (let d = weekStart; d < weekStart.plus({ days: 7 }); d = d.plus({ days: 1 })) {
    days.push(d.toISODate());
  }
  return days;
}

module.exports = {
  weeksInMonth,
  daysInWeek
};
