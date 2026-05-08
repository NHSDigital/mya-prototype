const express = require('express');
const router = express.Router();
const { DateTime } = require("luxon");

router.param('id', (req, res, next, id) => {
  req.site_id = id;
  res.locals.site_id = id;
  next();
});

router.use('/site/:id/cancel-availability', (req, res, next) => {
  res.locals.hideMainNav = true;
  next();
});

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const getStartAndEndDates = (data) => {

  //defensive parsing of form data
  if (!data || !data['cancelAvailability'] || !data['cancelAvailability']['startDate'] || !data['cancelAvailability']['endDate']) {
    //now in yyyyy-mm-dd format
    const today = DateTime.now().toISODate();
    const fortnight = DateTime.now().plus({ days: 14 }).toISODate();
    console.log('No form data provided, defaulting to today:', today, 'and fortnight:', fortnight);
    return { startDate: today, endDate: fortnight };
  }

  //data should contain ['cancelAvailability']['startDate']['year'], ['cancelAvailability']['startDate']['month'], ['cancelAvailability']['startDate']['day'] 
  //and ['cancelAvailability']['endDate']['year'], ['cancelAvailability']['endDate']['month'], ['cancelAvailability']['endDate']['day']
  //if any of these are missing, set default values
  //then return startDate and endDate as DateTime objects
  const startYear = data['cancelAvailability'] && data['cancelAvailability']['startDate'] && data['cancelAvailability']['startDate']['year'] ? parseInt(data['cancelAvailability']['startDate']['year']) : DateTime.now().year;
  const startMonth = data['cancelAvailability'] && data['cancelAvailability']['startDate'] && data['cancelAvailability']['startDate']['month'] ? parseInt(data['cancelAvailability']['startDate']['month']) : DateTime.now().month;
  const startDay = data['cancelAvailability'] && data['cancelAvailability']['startDate'] && data['cancelAvailability']['startDate']['day'] ? parseInt(data['cancelAvailability']['startDate']['day']) : DateTime.now().day;

  const endYear = data['cancelAvailability'] && data['cancelAvailability']['endDate'] && data['cancelAvailability']['endDate']['year'] ? parseInt(data['cancelAvailability']['endDate']['year']) : DateTime.now().year;
  const endMonth = data['cancelAvailability'] && data['cancelAvailability']['endDate'] && data['cancelAvailability']['endDate']['month'] ? parseInt(data['cancelAvailability']['endDate']['month']) : DateTime.now().month;
  const endDay = data['cancelAvailability'] && data['cancelAvailability']['endDate'] && data['cancelAvailability']['endDate']['day'] ? parseInt(data['cancelAvailability']['endDate']['day']) : DateTime.now().day;

  const startDate = DateTime.local(startYear, startMonth, startDay).toISODate();
  const endDate = DateTime.local(endYear, endMonth, endDay).toISODate();
  return { startDate, endDate };


}

const toMinutes = (hhmm = '') => {
  const [hours = 0, minutes = 0] = String(hhmm).split(':').map((v) => Number(v) || 0);
  return (hours * 60) + minutes;
}

const calculateTotalSlots = (session) => {
  const fromMinutes = toMinutes(session.from);
  const untilMinutes = toMinutes(session.until);
  const slotLength = Number(session.slotLength) || 10;
  const capacity = Number(session.capacity) || 1;
  const duration = Math.max(0, untilMinutes - fromMinutes);

  return Math.floor(duration / slotLength) * capacity;
}

const bookingDateIso = (booking) => {
  if (booking?.slotKey) return String(booking.slotKey).slice(0, 10);
  if (!booking?.datetime) return null;
  const dt = DateTime.fromISO(booking.datetime, { zone: 'Europe/London' });
  return dt.isValid ? dt.toISODate() : null;
}

const bookingTimeHHMM = (booking) => {
  if (booking?.slotKey) return String(booking.slotKey).slice(11, 16);
  if (!booking?.datetime) return null;
  const dt = DateTime.fromISO(booking.datetime, { zone: 'Europe/London' });
  return dt.isValid ? dt.toFormat('HH:mm') : null;
}

const bookingMatchesSession = (booking, session) => {
  const status = String(booking?.status || '').toLowerCase();
  if (status !== 'scheduled' && status !== 'orphaned') return false;

  const dateISO = bookingDateIso(booking);
  if (!dateISO || dateISO !== session.date) return false;

  if (booking?.sessionId && session?.id) {
    return String(booking.sessionId) === String(session.id);
  }

  if (booking?.recurringSessionId && session?.recurringId) {
    return String(booking.recurringSessionId) === String(session.recurringId);
  }

  const bookingTime = bookingTimeHHMM(booking);
  if (!bookingTime) return false;

  const bookingMinutes = toMinutes(bookingTime);
  return bookingMinutes >= toMinutes(session.from) && bookingMinutes < toMinutes(session.until);
}

const buildAffectedData = (siteDailyAvailability = {}, siteBookings = {}, startDateISO, endDateISO) => {
  const affectedSessions = [];

  for (const [date, dayData] of Object.entries(siteDailyAvailability || {})) {
    if (date < startDateISO || date > endDateISO) continue;

    for (const session of dayData?.sessions || []) {
      affectedSessions.push({
        date,
        id: session?.id || null,
        recurringId: session?.recurringId || null,
        from: session?.from,
        until: session?.until,
        services: Array.isArray(session?.services) ? session.services : [],
        slotLength: Number(session?.slotLength) || 10,
        capacity: Number(session?.capacity) || 1
      });
    }
  }

  const bookings = Object.values(siteBookings || {});
  const matchedBookingIds = new Set();

  for (const session of affectedSessions) {
    const sessionBookings = bookings.filter((booking) => bookingMatchesSession(booking, session));

    session.bookingCount = sessionBookings.length;
    session.totalSlots = calculateTotalSlots(session);
    session.unbookedCount = Math.max(0, session.totalSlots - session.bookingCount);

    const serviceCounts = {};
    for (const serviceId of session.services) {
      serviceCounts[serviceId] = sessionBookings.filter((booking) => String(booking.service) === String(serviceId)).length;
    }
    session.serviceBookingCounts = serviceCounts;

    for (const booking of sessionBookings) {
      matchedBookingIds.add(String(booking.id));
    }
  }

  const affectedBookings = bookings.filter((booking) => matchedBookingIds.has(String(booking.id)));

  return {
    affectedSessions,
    affectedBookings
  };

  
}

const applyDateRangeCancellation = (data, siteId, startDateISO, endDateISO, cancelBookings, affectedData) => {
  const siteRecurringSessions = data?.recurring_sessions?.[siteId] || {};
  const siteDailyAvailability = data?.daily_availability?.[siteId] || {};
  const siteBookings = data?.bookings?.[siteId] || {};

  const affectedRecurringIds = new Set(
    (affectedData?.affectedSessions || [])
      .map((session) => session?.recurringId)
      .filter(Boolean)
      .map(String)
  );

  for (const recurringId of affectedRecurringIds) {
    const recurringSession = siteRecurringSessions?.[recurringId];
    if (!recurringSession) continue;

    recurringSession.closures = Array.isArray(recurringSession.closures) ? recurringSession.closures : [];

    const alreadyClosedForRange = recurringSession.closures.some((closure) => {
      return closure?.startDate === startDateISO
        && closure?.endDate === endDateISO
        && closure?.label === 'Cancelled date range';
    });

    if (!alreadyClosedForRange) {
      recurringSession.closures.push({
        startDate: startDateISO,
        endDate: endDateISO,
        label: 'Cancelled date range'
      });
    }
  }

  for (const [date, day] of Object.entries(siteDailyAvailability || {})) {
    if (date < startDateISO || date > endDateISO) continue;
    if (!day?.sessions) continue;

    day.sessions = [];
  }

  if (cancelBookings) {
    for (const booking of (affectedData?.affectedBookings || [])) {
      const id = String(booking?.id || '');
      if (!id || !siteBookings[id]) continue;
      siteBookings[id].status = 'cancelled';
    }
  }

  data.cancelAvailability = data.cancelAvailability || {};
  data.cancelAvailability.affectedSessions = String((affectedData?.affectedSessions || []).length);
  data.cancelAvailability.affectedBookings = String((affectedData?.affectedBookings || []).length);
}

// -----------------------------------------------------------------------------
// Cancel availability for a date range
// -----------------------------------------------------------------------------
router.get('/site/:id/cancel-availability', (req, res) => {
  res.redirect(`/site/${req.params.id}/cancel-availability/dates`);
});

router.get('/site/:id/cancel-availability/dates', (req, res) => {
  res.render('site/cancel-a-date-range/dates');
});


router.all('/site/:id/cancel-availability/sessions-and-bookings', (req, res) => {
  const { startDate, endDate } = getStartAndEndDates(req.session.data);
  const siteDailyAvailability = res.locals.dailyAvailability || {};
  const siteBookings = req.session.data?.bookings?.[req.site_id] || {};
  const { affectedSessions, affectedBookings } = buildAffectedData(siteDailyAvailability, siteBookings, startDate, endDate);

  res.render('site/cancel-a-date-range/sessions-and-bookings', {
    startDate, 
    endDate,
    affectedSessions,
    affectedBookings,
    ...req.query //pass through any query params for testing
  });
});

router.all('/site/:id/cancel-availability/check-answers', (req, res) => {
  const { startDate, endDate } = getStartAndEndDates(req.session.data);
  const siteDailyAvailability = res.locals.dailyAvailability || {};
  const siteBookings = req.session.data?.bookings?.[req.site_id] || {};
  const affectedData = buildAffectedData(siteDailyAvailability, siteBookings, startDate, endDate);

  req.session.data.cancelAvailability = req.session.data.cancelAvailability || {};
  req.session.data.cancelAvailability.affectedSessions = String(affectedData.affectedSessions.length);
  req.session.data.cancelAvailability.affectedBookings = String(affectedData.affectedBookings.length);

  if (req.method === 'POST') {
    const cancelBookings = req.session.data.cancelAvailability.keepOrCancelBookings === 'cancel';

    applyDateRangeCancellation(
      req.session.data,
      req.site_id,
      startDate,
      endDate,
      cancelBookings,
      affectedData
    );

    return res.redirect(`/site/${req.site_id}/cancel-availability/success`);
  }

  res.render('site/cancel-a-date-range/check-answers', { startDate, endDate });
});

router.all('/site/:id/cancel-availability/success', (req, res) => {
  const { startDate, endDate } = getStartAndEndDates(req.session.data);

  res.render('site/cancel-a-date-range/success', { startDate, endDate });
});

// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;