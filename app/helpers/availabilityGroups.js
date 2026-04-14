const generateGroupId = require('./groupId');

const weekdayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function toMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours * 60) + minutes;
}

function sessionKey(session) {
  const services = [...(session.services || [])].sort().join('|');
  return `${session.from}|${session.until}|${session.slotLength}|${session.capacity}|${services}`;
}

function addSlotInfo(session) {
  const durationMins = Math.max(0, toMinutes(session.until) - toMinutes(session.from));
  const slotLength = Number(session.slotLength) || 10;
  const capacity = Number(session.capacity) || 1;
  const perHour = Math.round((60 / slotLength) * capacity);
  const perSession = Math.round((durationMins / slotLength) * capacity);

  return {
    ...session,
    slotLength,
    capacity,
    services: session.services || [],
    counts: {
      perHour,
      perSession
    }
  };
}

function groupSessions(data) {
  const grouped = new Map();

  for (const day of Object.values(data || {})) {
    const date = day?.date;
    const sessions = day?.sessions || [];
    if (!date || !Array.isArray(sessions)) continue;

    for (const session of sessions) {
      const key = sessionKey(session);

      if (!grouped.has(key)) {
        grouped.set(key, {
          id: generateGroupId(session),
          session: addSlotInfo(session),
          dates: [],
          sessionIds: []
        });
      }

      const group = grouped.get(key);
      group.dates.push(date);
      if (session.id) group.sessionIds.push(session.id);
    }
  }

  return Array.from(grouped.values());
}

function summariseWeekdays(group) {
  const summary = {};
  weekdayNames.forEach(day => (summary[day] = 0));

  group.dates.forEach(date => {
    const dayOfWeek = new Date(`${date}T12:00:00Z`).getUTCDay();
    const name = weekdayNames[dayOfWeek];
    summary[name] += 1;
  });

  return { ...group, weekdaySummary: summary };
}

function availabilityGroups(data, startDate = null, endDate = null) {
  const totals = {};
  weekdayNames.forEach(day => (totals[day] = 0));

  const grouped = groupSessions(data)
    .map(g => {
      const filteredDates = g.dates.filter((d) => {
        if (startDate && d < startDate) return false;
        if (endDate && d > endDate) return false;
        return true;
      });

      return { ...g, dates: filteredDates };
    })
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
