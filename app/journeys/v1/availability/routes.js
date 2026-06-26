// Journey: availability (day / week / month views)
// URL base: /site/:id/availability/{day,week,month}
// Per-site context (res.locals.dailyAvailability, res.locals.slots) is provided
// centrally by app/journeys/_shared/site-context.js.

const express = require('express');
const router = express.Router();
const { DateTime } = require('luxon');

const {
  getToday,
  asArray,
  buildWeekAvailabilitySummary,
  buildMonthWeekRanges,
  buildMonthAvailabilitySummary,
  sortSessionsForAvailability,
} = require('../_shared/helpers');

router.get('/site/:id/availability/day', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const date = req.query.date || getToday();
  const today = getToday();
  const tomorrow = DateTime.fromISO(date).plus({ days: 1 }).toISODate();
  const yesterday = DateTime.fromISO(date).minus({ days: 1 }).toISODate();
  const daySummary = buildWeekAvailabilitySummary(
    [date],
    res.locals.dailyAvailability,
    res.locals.slots,
    data.services || {},
    data?.bookings?.[site_id] || {},
    site_id,
    today,
    data?.recurring_sessions?.[site_id] || {},
    `/site/${site_id}/availability/day?date=${date}`
  )[0] || {
    date,
    sessions: [],
    totalAppointments: 0,
    bookedAppointments: 0,
    unbookedAppointments: 0,
    isToday: date === today,
    isPast: date < today,
    dayViewHref: `/site/${site_id}/availability/day?date=${date}`
  };

  if ((daySummary.sessions || []).length === 0 && (res.locals.dailyAvailability?.[date]?.sessions || []).length > 0) {
    const dateSlots = asArray(res.locals.slots?.[date]);
    const sessions = sortSessionsForAvailability(res.locals.dailyAvailability?.[date]?.sessions);
    const siteBookings = data?.bookings?.[site_id] || {};
    const servicesById = data.services || {};

    const fallbackSessions = sessions.map((session) => {
      const sessionSlots = dateSlots.filter((slot) => (
        (slot?.sessionId && session?.id && String(slot.sessionId) === String(session.id))
        || (
          !slot?.sessionId
          && slot?.group?.start === session?.from
          && slot?.group?.end === session?.until
          && (!slot?.recurringSessionId || !session?.recurringId || String(slot.recurringSessionId) === String(session.recurringId))
        )
      ));

      const bookedTotal = sessionSlots.filter((slot) => slot?.booking_status === 'scheduled').length;
      const totalSlots = sessionSlots.length;
      const resolvedLabel = session.label || data?.recurring_sessions?.[site_id]?.[session?.recurringId]?.label || '';
      const cancelHref = date < today || !session?.recurringId
        ? null
        : `/site/${site_id}/clinics/cancel/${session.id}`;

      return {
        id: session.id,
        label: resolvedLabel,
        from: session.from,
        until: session.until,
        services: asArray(session.services).map((serviceId) => ({
          id: serviceId,
          name: servicesById?.[serviceId]?.name || serviceId,
          bookedCount: sessionSlots.filter((slot) => (
            slot?.booking_status === 'scheduled'
            && slot?.booking_id
            && siteBookings?.[slot.booking_id]?.service === serviceId
          )).length
        })),
        bookedTotal,
        unbookedTotal: Math.max(0, totalSlots - bookedTotal),
        actionHref: date < today || !session?.recurringId
          ? null
          : `/site/${site_id}/change/session/${session.id}?back=${encodeURIComponent(`/site/${site_id}/availability/day?date=${date}`)}`,
        cancelHref
      };
    });

    daySummary.sessions = fallbackSessions;
    daySummary.totalAppointments = fallbackSessions.reduce((sum, session) => sum + session.bookedTotal + session.unbookedTotal, 0);
    daySummary.bookedAppointments = fallbackSessions.reduce((sum, session) => sum + session.bookedTotal, 0);
    daySummary.unbookedAppointments = Math.max(0, daySummary.totalAppointments - daySummary.bookedAppointments);
  }

  res.render('availability/day', {
    date,
    today,
    tomorrow,
    yesterday,
    daySummary
  });
});

router.get('/site/:id/availability/week', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const startFromDate = req.query.date || getToday();
  const today = getToday();

  //return dates for the week containing 'date'
  const week = [];
  const dt = DateTime.fromISO(startFromDate);
  const startOfWeek = dt.startOf('week'); //assuming week starts on Monday
  for (let i = 0; i < 7; i++) {
    week.push(startOfWeek.plus({ days: i }).toISODate());
  }

  //return previous and next week dates
  const previousWeek = {
    start:startOfWeek.minus({ days: 7 }).toISODate(), //previous Monday
    end: startOfWeek.minus({ days: 1 }).toISODate() //previous Sunday
  }
  const nextWeek = {
    start: startOfWeek.plus({ days: 7 }).toISODate(), //next Monday
    end: startOfWeek.plus({ days: 13 }).toISODate() //next Sunday
  }

  const weekDays = buildWeekAvailabilitySummary(
    week,
    res.locals.dailyAvailability,
    res.locals.slots,
    data.services || {},
    data?.bookings?.[site_id] || {},
    site_id,
    today,
    data?.recurring_sessions?.[site_id] || {},
    `/site/${site_id}/availability/week?date=${startFromDate}`
  );

  res.render('availability/week', {
    date: startFromDate,
    today,
    week,
    weekDays,
    previousWeek,
    nextWeek
  });
});

router.get('/site/:id/availability/month', (req, res) => {
  const data = req.session.data;
  const site_id = req.site_id;
  const today = getToday();
  const monthData = buildMonthWeekRanges(req.query.date || today);
  const recurringSessions = data?.recurring_sessions?.[site_id] || {};
  const monthWeeks = buildMonthAvailabilitySummary(
    monthData.weeks,
    res.locals.dailyAvailability,
    res.locals.slots,
    data.services || {},
    data?.bookings?.[site_id] || {},
    site_id,
    today,
    recurringSessions
  );

  res.render('availability/month', {
    today,
    currentDate: monthData.currentDate,
    previousMonthDate: monthData.previousMonthDate,
    nextMonthDate: monthData.nextMonthDate,
    monthWeeks
  });
});

module.exports = router;
