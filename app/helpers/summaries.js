// summarise.js
const { DateTime } = require('luxon');

// ---- CONFIG ----
const LOCAL_TZ = "Europe/London"; // align bookings to local session times

// ---- HELPERS ----
const toMinutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

const inWindow = (minutes, fromHHMM, untilHHMM) => {
  const start = toMinutes(fromHHMM);
  const end = toMinutes(untilHHMM);
  return minutes >= start && minutes < end; // [start, end)
};

const slotCount = ({ from, until, slotLength, capacity }) => {
  const mins = toMinutes(until) - toMinutes(from);
  return Math.max(0, Math.floor(mins / slotLength)) * capacity;
};

const weekKey = (isoDate) => {
  const d = DateTime.fromISO(isoDate, { zone: LOCAL_TZ });
  return `${d.weekYear}-W${String(d.weekNumber).padStart(2, "0")}`;
};
const monthKey = (isoDate) =>
  DateTime.fromISO(isoDate, { zone: LOCAL_TZ }).toFormat("yyyy-MM");

const ensureBucket = (obj, key) =>
  (obj[key] ??= { totalSlots: 0, bookedSlots: 0, availableSlots: 0, bookingsPerService: {} });

const bump = (map, key, by = 1) => (map[key] = (map[key] || 0) + by);

// ---- CORE ----
/**
 * bookings: { id: { datetime, service, status, ... }, ... }
 * availability: { "YYYY-MM-DD": { sessions: [{from,until,slotLength,capacity,services?}, ...] }, ... }
 * groups: [{ id, session: {from,until,slotLength,capacity,services?}, dates: ["YYYY-MM-DD", ...] }, ...]
 */
function summarise({ bookings = {}, availability = {}, groups = [] }) {
  const daily = {};
  const weekly = {};
  const monthly = {};
  const byGroup = {};

  // Precompute group slot totals and a quick lookup of groups per date
  /** date -> [{ groupId, session }] */
  const groupsByDate = {};
  for (const g of groups) {
    const perDaySlots = slotCount(g.session);
    byGroup[g.id] = ensureBucket({}, g.id); // creates shape
    byGroup[g.id].totalSlots = perDaySlots * g.dates.length;

    for (const date of g.dates) {
      const d = ensureBucket(daily, date);
      d.totalSlots += perDaySlots;

      const wk = ensureBucket(weekly, weekKey(date));
      wk.totalSlots += perDaySlots;
      const mo = ensureBucket(monthly, monthKey(date));
      mo.totalSlots += perDaySlots;

      (groupsByDate[date] ??= []).push({ groupId: g.id, session: g.session });
    }
  }

  // Add ad-hoc availability slots (non-group daily sessions)
  for (const [date, avail] of Object.entries(availability)) {
    let total = 0;
    for (const s of avail.sessions || []) total += slotCount(s);

    const d = ensureBucket(daily, date);
    d.totalSlots += total;
    const wk = ensureBucket(weekly, weekKey(date));
    wk.totalSlots += total;
    const mo = ensureBucket(monthly, monthKey(date));
    mo.totalSlots += total;
  }

  // Process bookings — only "scheduled"
  /** To prevent assigning one booking to multiple groups, we pick the first matching group for that date/time/service. */
  for (const b of Object.values(bookings)) {
    if (b.status !== "scheduled") continue;

    // Convert to local date & minutes-since-midnight to compare with session windows
    const dt = DateTime.fromISO(b.datetime).setZone(LOCAL_TZ);
    const date = dt.toISODate();
    const minuteOfDay = dt.hour * 60 + dt.minute;
    const service = b.service;

    // Daily / Week / Month booked increments
    const d = ensureBucket(daily, date);
    d.bookedSlots += 1;
    bump(d.bookingsPerService, service);

    const wk = ensureBucket(weekly, weekKey(date));
    wk.bookedSlots += 1;
    bump(wk.bookingsPerService, service);

    const mo = ensureBucket(monthly, monthKey(date));
    mo.bookedSlots += 1;
    bump(mo.bookingsPerService, service);

    // Try to assign this booking to ONE group (time + service match)
    const todaysGroups = groupsByDate[date] || [];
    let assigned = false;

    for (const { groupId, session } of todaysGroups) {
      // time inside window?
      if (!inWindow(minuteOfDay, session.from, session.until)) continue;
      // service allowed? (if services array present, require inclusion)
      if (Array.isArray(session.services) && session.services.length > 0) {
        if (!session.services.includes(service)) continue;
      }
      // assign and stop
      const g = byGroup[groupId] || ensureBucket(byGroup, groupId);
      g.bookedSlots += 1;
      bump(g.bookingsPerService, service);
      assigned = true;
      break; // IMPORTANT: avoid double counting across groups
    }

    // (Optional) If you want to count bookings that don't belong to any group into a synthetic "ungrouped" bucket:
    // if (!assigned) {
    //   const g = byGroup["_ungrouped"] || ensureBucket(byGroup, "_ungrouped");
    //   g.bookedSlots += 1;
    //   bump(g.bookingsPerService, service);
    // }
  }

  // Derive availableSlots everywhere (never negative)
  const applyAvailable = (obj) => {
    for (const val of Object.values(obj)) {
      val.availableSlots = Math.max(0, val.totalSlots - val.bookedSlots);
    }
  };
  applyAvailable(daily);
  applyAvailable(weekly);
  applyAvailable(monthly);
  applyAvailable(byGroup);

  return { daily, weekly, monthly, byGroup };
}

module.exports = summarise;
