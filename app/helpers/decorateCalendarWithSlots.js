const { DateTime } = require('luxon');

/**
 * Decorate a calendar() output with slot + booking counts.
 * Fully respects capacity-based slots and group filters.
 *
 * @param {Object} calendarData - Output from calendar()
 * @param {Object} slots - { 'YYYY-MM-DD': [slot, slot, ...] }
 * @param {DateTime} [today=DateTime.now()]
 * @param {String|null} [groupId=null]
 * @returns {Object} A decorated calendar with totals per day
 */
function decorateCalendarWithSlots(calendarData, slots, today = DateTime.now(), groupId = null) {
  // clone so we don't mutate original
  const result = JSON.parse(JSON.stringify(calendarData));
  const todayISO = today.toISODate();

  for (const [year, months] of Object.entries(result.dates)) {
    for (const [month, monthData] of Object.entries(months)) {
      monthData.weeks = monthData.weeks.map(week =>
        week.map(day => {
          if (!day) return null;

          const dateISO = day.iso;
          let daySlots = slots?.[dateISO] || [];

          // 🔍 Filter to this group's slots only (if applicable)
          if (groupId) {
            daySlots = daySlots.filter(s => s.group?.id === groupId);
          }

          // 🔢 Count total & booked
          const totalSlots = daySlots.length;
          const totalBooked = daySlots.filter(s => s.booking_status === 'scheduled').length;

          return {
            ...day,
            totalSlots,
            totalBooked,
            hasEntry: totalSlots > 0,
            isPast: dateISO < todayISO
          };
        })
      );
    }
  }

  return result;
}

module.exports = { decorateCalendarWithSlots };
