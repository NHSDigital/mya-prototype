function sessionsEqual(a, b) {
  return (
    a.from === b.from &&
    a.until === b.until &&
    a.slotLength === b.slotLength &&
    a.capacity === b.capacity &&
    JSON.stringify([...a.services].sort()) === JSON.stringify([...b.services].sort())
  );
}

function groupSessions(data) {
  const sessionGroups = [];

  for (const dayKey in data) {
    const day = data[dayKey];
    for (const session of day.sessions) {
      const existingGroup = sessionGroups.find(g => sessionsEqual(g.session, session));
      if (existingGroup) {
        existingGroup.dates.push(day.date);
      } else {
        sessionGroups.push({ session, dates: [day.date] });
      }
    }
  }

  return sessionGroups;
}

function summariseWeekdays(group) {
  const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  // Initialise all weekdays with 0
  const summary = {};
  weekdayNames.forEach(day => (summary[day] = 0));

  // Count occurrences
  group.dates.forEach(date => {
    const dayOfWeek = new Date(date).getDay();
    const name = weekdayNames[dayOfWeek];
    summary[name] += 1;
  });

  return {
    ...group,
    weekdaySummary: summary,
  };
}

function availabilityGroups(data) {
  const grouped = groupSessions(data);
  return grouped.map(summariseWeekdays);
}

module.exports = { availabilityGroups };
