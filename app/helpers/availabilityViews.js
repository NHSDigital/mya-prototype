// availabilityViews.lite.js
// Minimal helpers to build day/week/month models + weekly stats for a prototype.
// Assumptions: Europe/London TZ, valid strings like "yyyy-MM-dd" and ISO datetimes,
// weekly repeating availability, and simple slot/service matching.

const { DateTime } = require("luxon");

const ZONE = "Europe/London";

/* ---------- tiny helpers ---------- */

function dt(input) {
  if (!input) return DateTime.invalid("no-input");
  if (DateTime.isDateTime(input)) return input.setZone(ZONE);
  if (input instanceof Date) return DateTime.fromJSDate(input, { zone: ZONE });
  if (typeof input === "number") return DateTime.fromMillis(input, { zone: ZONE });
  // Try ISO, then yyyy-MM-dd
  let d = DateTime.fromISO(String(input), { zone: ZONE });
  if (d.isValid) return d;
  d = DateTime.fromFormat(String(input), "yyyy-MM-dd", { zone: ZONE });
  return d.isValid ? d : DateTime.invalid("bad-input");
}

function minutesFromHM(hm) {
  const [h, m] = String(hm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function dateMatchesRow(availabilityRow, date) {
  return (availabilityRow.days || []).includes(date.toFormat("cccc"));
}

function dateWithinRowSpan(availabilityRow, date) {
  const start = dt(availabilityRow.startDate);
  const end = dt(availabilityRow.endDate)?.endOf("day");
  return start.isValid && end.isValid && date >= start && date <= end;
}

/* ---------- slots for a single day ---------- */

function buildSlotsForDay(availabilityList, dayInput, { siteId = null } = {}) {
  const date = dt(dayInput)?.startOf("day");
  if (!date?.isValid) return [];

  const slots = [];
  for (const row of availabilityList) {
    if (siteId && row.site_id !== siteId) continue;
    if (!dateMatchesRow(row, date) || !dateWithinRowSpan(row, date)) continue;

    const startM = minutesFromHM(row.startTime);
    const endM = minutesFromHM(row.endTime);
    const step = Number(row.duration) || 10;
    for (let m = startM; m + step <= endM; m += step) {
      const start = date.plus({ minutes: m });
      slots.push({
        site_id: row.site_id,
        start,
        end: start.plus({ minutes: step }),
        services: row.services || [],
        capacity: Number(row.capacity) || 1,
      });
    }
  }
  return slots;
}

/* ---------- attach bookings to slots for a day ---------- */

function dayView({ availability = [], bookings = [] }, dayInput, { siteId = null } = {}) {
  const date = dt(dayInput)?.startOf("day");
  if (!date?.isValid) throw new Error("Invalid date for dayView");

  const slots = buildSlotsForDay(availability, date, { siteId });

  // Index bookings for that day (and site if provided)
  const start = date.startOf("day");
  const end = date.endOf("day");
  const todays = bookings.filter(b => {
    if (siteId && b.site_id !== siteId) return false;
    const bd = dt(b.datetime);
    return bd.isValid && bd >= start && bd <= end;
  });

  // Match by exact start minute and service
  const map = new Map(); // key = `${site}|${isoMinute}`
  for (const b of todays) {
    const bd = dt(b.datetime);
    if (!bd.isValid) continue;
    const key = `${b.site_id}|${bd.toISO({ suppressSeconds: true, suppressMilliseconds: true })}`;
    (map.get(key) || map.set(key, []).get(key)).push(b);
  }

  const hydrated = slots.map(s => {
    const key = `${s.site_id}|${s.start.toISO({ suppressSeconds: true, suppressMilliseconds: true })}`;
    const matched = (map.get(key) || []).filter(b => s.services.includes(b.service));
    return {
      ...s,
      bookings: matched,
      remaining: Math.max(0, s.capacity - matched.length),
    };
  });

  // Orphans (bookings on that day that didn’t match any slot)
  const matchedKeys = new Set(
    hydrated.flatMap(s =>
      (s.bookings || []).map(b => {
        const bd = dt(b.datetime);
        return `${b.site_id}|${bd.toISO({ suppressSeconds: true, suppressMilliseconds: true })}`;
      })
    )
  );
  const orphanBookings = todays.filter(b => {
    const bd = dt(b.datetime);
    const key = `${b.site_id}|${bd.toISO({ suppressSeconds: true, suppressMilliseconds: true })}`;
    return !matchedKeys.has(key);
  });

  return { date, slots: hydrated, orphanBookings };
}

/* ---------- week and month ---------- */

//this function return this object:
// { weekStart: DateTime, days: [ { date: DateTime, count: number, bookings: [booking] } ] }

function weekView({ availability = [], bookings = [] }, weekStartInput, { siteId = null } = {}) {
  const weekStart = dt(weekStartInput)?.startOf("week"); // Monday
  if (!weekStart?.isValid) throw new Error("Invalid weekStart for weekView");

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = weekStart.plus({ days: i });
    const { slots, orphanBookings } = dayView({ availability, bookings }, d, { siteId });
    const allBookings = [...slots.flatMap(s => s.bookings || []), ...orphanBookings];
    days.push({ date: d, count: allBookings.length, bookings: allBookings });
  }
  return { weekStart, days };
}

function monthView({ availability = [], bookings = [] }, year, month, { siteId = null } = {}) {
  console.log('year',year,'month',month);
  const first = DateTime.local(year, month, 1).startOf("day");
  if (!first.isValid) throw new Error("Invalid year/month");
  const monthStart = first.startOf("month");
  const monthEnd = first.endOf("month");

  let cursor = monthStart.startOf("week");
  const gridEnd = monthEnd.endOf("week");

  const weeks = [];
  while (cursor <= gridEnd) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = cursor.plus({ days: i });
      const { slots, orphanBookings } = dayView({ availability, bookings }, d, { siteId });
      const allBookings = [...slots.flatMap(s => s.bookings || []), ...orphanBookings];
      days.push({ date: d, inMonth: d.month === month, count: allBookings.length });
    }
    weeks.push({ days });
    cursor = cursor.plus({ weeks: 1 });
  }
  return { monthStart, weeks };
}

/* ---------- weekly stats (simple) ---------- */

//This is a simple function to get some stats for a week, given availability and bookings
// It counts total possible slots, total booked, total unbooked, total cancelled
// It also counts bookings per service (for services that had availability advertised in the week)
// It can filter by siteId, and optionally include "orphan" bookings that didn't match any slot

// Returns:
// { weekStart: DateTime, weekEnd: DateTime,
//   bookingsPerService: { [serviceId]: number },
//   totalPossibleSlots: number, totalBooked: number, totalUnbooked: number, totalCancelled: number }

function weekStats({ availability = [], bookings = [] }, weekStartInput, { siteId = null, includeOrphans = false } = {}) {
  const weekStart = dt(weekStartInput)?.startOf("week");
  if (!weekStart?.isValid) throw new Error("Invalid weekStart for weekStats");
  const weekEnd = weekStart.plus({ days: 6 }).endOf("day");

  let totalPossibleSlots = 0;
  let totalBooked = 0;
  let totalUnbooked = 0;
  let totalCancelled = 0;

  const bookingsPerService = {};
  const servicesAdvertised = new Set();

  for (let i = 0; i < 7; i++) {
    const currentDate = weekStart.plus({ days: i });
    const { slots, orphanBookings } = dayView({ availability, bookings }, currentDate, { siteId });

    for (const slot of slots) {
      const cap = Number(slot.capacity) || 0;
      totalPossibleSlots += cap;
      (slot.services || []).forEach(s => servicesAdvertised.add(s));

      const active = (slot.bookings || []).filter(b => (b.status || "scheduled").toLowerCase() !== "cancelled");
      totalBooked += active.length;
      totalUnbooked += Math.max(0, cap - active.length);
      for (const b of active) bookingsPerService[b.service] = (bookingsPerService[b.service] || 0) + 1;

      totalCancelled += (slot.bookings || []).filter(b => (b.status || "").toLowerCase() === "cancelled").length;
    }

    if (includeOrphans) {
      const activeOrphans = (orphanBookings || []).filter(b => (b.status || "scheduled").toLowerCase() !== "cancelled");
      totalBooked += activeOrphans.length;
      for (const b of activeOrphans) bookingsPerService[b.service] = (bookingsPerService[b.service] || 0) + 1;
      totalCancelled += (orphanBookings || []).filter(b => (b.status || "").toLowerCase() === "cancelled").length;
    }
  }

  // Also catch cancelled bookings in the week that didn't match a dayView (defensive)
  totalCancelled += bookings
    .filter(b => (siteId ? b.site_id === siteId : true))
    .filter(b => {
      const bd = dt(b.datetime);
      return bd.isValid && bd >= weekStart && bd <= weekEnd && (b.status || "").toLowerCase() === "cancelled";
    }).length;

  servicesAdvertised.forEach(svc => { if (!(svc in bookingsPerService)) bookingsPerService[svc] = 0; });

  return { weekStart, weekEnd, bookingsPerService, totalPossibleSlots, totalBooked, totalUnbooked, totalCancelled };
}

/* ---------- tiny label helpers ---------- */

function labelDay(dateTime) { return dateTime.toFormat("cccc d LLLL yyyy"); }
function labelHM(dateTime)  { return dateTime.toFormat("HH:mm"); }

module.exports = { dayView, weekView, monthView, weekStats, labelDay, labelHM };