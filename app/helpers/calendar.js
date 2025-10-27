const { DateTime } = require('luxon');

function calendar(dates) {
  const dateSet = new Set(dates);
  const grouped = {};
  let totalMonths = 0;

  // Group by year and month
  for (const iso of dates) {
    const d = DateTime.fromISO(iso);
    const { year, month } = d;
    if (!grouped[year]) grouped[year] = {};
    if (!grouped[year][month]) grouped[year][month] = new Set();
    grouped[year][month].add(iso);
  }

  const result = {};

  for (const [year, months] of Object.entries(grouped)) {
    result[year] = {};

    for (const [month, dateSetForMonth] of Object.entries(months)) {
      const first = DateTime.fromObject({ year: +year, month: +month, day: 1 });
      const daysInMonth = first.daysInMonth;
      const startWeekday = (first.weekday + 6) % 7; // Monday = 0
      const weeks = [];
      totalMonths++;
      let week = Array(startWeekday).fill(null);

      for (let day = 1; day <= daysInMonth; day++) {
        const date = DateTime.fromObject({ year: +year, month: +month, day });
        const iso = date.toISODate();
        const hasEntry = dateSet.has(iso);

        week.push({
          day,
          iso,
          hasEntry,
          weekday: date.weekday, // 1–7 (Mon–Sun)
        });

        if (week.length === 7) {
          weeks.push(week);
          week = [];
        }
      }

      if (week.length) {
        while (week.length < 7) week.push(null);
        weeks.push(week);
      }

      result[year][month] = {
        label: first.toFormat('LLLL yyyy'), // e.g. "October 2025"
        weeks,
      };
    }
  }

  return { 
    dates: result, 
    counts: {
      totalMonths,
      totalDays: dates.length
    } 
  };
}

module.exports = { calendar };
