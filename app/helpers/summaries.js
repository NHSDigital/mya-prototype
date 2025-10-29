// app/data/helpers/summaries.js
const { DateTime } = require('luxon');
const { slotsForDay } = require('./slots');

// Sum multiple count objects
function addCounts(total, add) {
  for (const key of Object.keys(add)) {
    if (typeof add[key] === 'number') total[key] = (total[key] || 0) + add[key];
  }
  return total;
}

function getDaySummary(site_id, dateISO, daily_availability, bookings) {
  const dayAvail = daily_availability[site_id]?.[dateISO];
  const day = slotsForDay(dayAvail, bookings[site_id], site_id);
  if (!day) return false;

  return {
    site_id,
    date: dateISO,
    ...day
  };
}

function getWeekSummary(site_id, weekStartISO, daily_availability, bookings) {
  const weekStart = DateTime.fromISO(weekStartISO, { zone: 'Europe/London' }).startOf('week');
  const days = [];
  const totals = { scheduled: 0, cancelled: 0, orphaned: 0, totalSlots: 0 };

  for (let i = 0; i < 7; i++) {
    const date = weekStart.plus({ days: i }).toISODate();
    const summary = getDaySummary(site_id, date, daily_availability, bookings);
    if (summary) {
      days.push(summary);
      addCounts(totals, summary);
    }
  }

  return { site_id, weekStart: weekStart.toISODate(), totals, days };
}

function getMonthSummary(site_id, monthStartISO, daily_availability, bookings) {
  const start = DateTime.fromISO(monthStartISO, { zone: 'Europe/London' }).startOf('month');
  const end = start.endOf('month');
  const days = [];
  const totals = { scheduled: 0, cancelled: 0, orphaned: 0, totalSlots: 0 };
  const perService = {};

  for (let dt = start; dt <= end; dt = dt.plus({ days: 1 })) {
    const dateISO = dt.toISODate();
    const summary = getDaySummary(site_id, dateISO, daily_availability, bookings);
    if (!summary) continue;

    days.push(summary);
    addCounts(totals, summary);

    for (const slot of summary.slots) {
      if (slot.booking) {
        const s = slot.booking.service;
        if (!perService[s]) perService[s] = { booked: 0, cancelled: 0, orphaned: 0 };
        perService[s][slot.booking.status]++;
      }
    }
  }

  return {
    site_id,
    month: start.toFormat('LLLL yyyy'),
    totals,
    perService: Object.entries(perService).map(([service, counts]) => ({ service, ...counts })),
    days
  };
}

module.exports = { getDaySummary, getWeekSummary, getMonthSummary };
