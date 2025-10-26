const { DateTime } = require('luxon');
const crypto = require('crypto');

const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

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
    slots: {
      perHour: Math.round(slotsPerHour),
      perSession: Math.round(slotsPerSession),
    },
  };
}

//Helper: generate a stable group ID for a session
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

//Helper: calculate slots info for a session
function calculateSlots(session) {
  const from = parseTime(session.from);
  const until = parseTime(session.until);

  const durationMins = (until - from) / (1000 * 60); // minutes
  const slotsPerSession = (durationMins / session.slotLength) * session.capacity;
  const slotsPerHour = (60 / session.slotLength) * session.capacity;

  return {
    perHour: Math.round(slotsPerHour),
    perSession: Math.round(slotsPerSession),
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

// Step 3: separate single-day vs multi-day, and aggregate weekday totals
function availabilityGroups(data, site_id) {
  const totals = {};
  weekdayNames.forEach(day => (totals[day] = 0));

  const grouped = groupSessions(data).map(summariseWeekdays);

  const repeating = [];
  const single = [];

  grouped.forEach(g => {
    // add to totals
    for (const day in g.weekdaySummary) {
      totals[day] += g.weekdaySummary[day];
    }

    // classify into single vs repeating
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
