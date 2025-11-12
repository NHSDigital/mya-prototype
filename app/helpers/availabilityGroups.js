const { DateTime } = require('luxon');
const generateGroupId = require('./groupId');

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// Helper: compare two sessions for equality
function sessionsEqual(a, b) {
  return (
    a.from === b.from &&
    a.until === b.until &&
    a.slotLength === b.slotLength &&
    a.capacity === b.capacity &&
    JSON.stringify([...a.services].sort()) === JSON.stringify([...b.services].sort())
  );
}

// Helper: to parse time strings
function parseTime(timeStr) {
  return DateTime.fromFormat(timeStr, 'HH:mm');
}

// Helper: add slot counts to a session
function addSlotInfo(session) {
  const from = parseTime(session.from);
  const until = parseTime(session.until);

  const durationMins = (until - from) / (1000 * 60); // minutes
  const slotsPerSession = (durationMins / session.slotLength) * session.capacity;
  const slotsPerHour = (60 / session.slotLength) * session.capacity;

  return {
    ...session,
    counts: {
      perHour: Math.round(slotsPerHour),
      perSession: Math.round(slotsPerSession)
    },
  };
}

// Step 1: group identical sessions across all days
function groupSessions(data) {
  const sessionGroups = [];

  for (const dayKey in data) {
    const day = data[dayKey];
    for (const session of day.sessions) {
      const existingGroup = sessionGroups.find(g => sessionsEqual(g.session, session));
      if (existingGroup) {
        existingGroup.dates.push(day.date);
      } else {
        sessionGroups.push({
          id: generateGroupId(session),
          session: addSlotInfo(session),
          dates: [day.date]
        });
      }
    }
  }

  return sessionGroups;
}

// Step 2: build weekday summary for each group
function summariseWeekdays(group) {
  const summary = {};
  weekdayNames.forEach(day => (summary[day] = 0));

  group.dates.forEach(date => {
    const dayOfWeek = new Date(date).getDay();
    const name = weekdayNames[dayOfWeek];
    summary[name] += 1;
  });

  return { ...group, weekdaySummary: summary };
}

// Step 3: filter, classify, and aggregate totals
function availabilityGroups(data, startDate = null, endDate = null) {
  const totals = {};
  weekdayNames.forEach(day => (totals[day] = 0));

  const grouped = groupSessions(data)
    // ✅ optional date filters
    .map(g => {
      let filteredDates = g.dates;

      if (startDate) {
        const cutoffStart = DateTime.fromISO(startDate);
        filteredDates = filteredDates.filter(d => DateTime.fromISO(d) >= cutoffStart);
      }

      if (endDate) {
        const cutoffEnd = DateTime.fromISO(endDate);
        filteredDates = filteredDates.filter(d => DateTime.fromISO(d) <= cutoffEnd);
      }

      return { ...g, dates: filteredDates };
    })
    // ✅ drop empty groups
    .filter(g => g.dates.length > 0)
    .map(summariseWeekdays);

  const repeating = [];
  const single = [];

  grouped.forEach(g => {
    for (const day in g.weekdaySummary) {
      totals[day] += g.weekdaySummary[day];
    }

    if (g.dates.length > 1) {
      g.type = 'repeating';
      repeating.push(g);
    } else {
      g.type = 'single';
      single.push(g);
    }
  });

  return { repeating, single, counts: totals };
}


module.exports = { availabilityGroups };
