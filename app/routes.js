// External dependencies
const express = require('express')

const router = express.Router()
const { flagsMiddleware } = require('./flags/flags-library')
const { siteLevelMiddleware } = require('./middleware/site-level')
const { weeksInMonth, daysInWeek } = require("./helpers/weekAndMonthViews")
const { slotsForDay } = require("./helpers/day")
const { DateTime } = require('luxon');
const updateDailyAvailability = require('./helpers/updateDailyAvailability')

router.use(flagsMiddleware())
router.use(siteLevelMiddleware())

//set global param for site_id
router.param('id', (req, res, next, id) => {
  req.site_id = id;          // available in routes
  res.locals.site_id = id;   // available in all views
  next();
}); 
router.get('/site/:id', (req, res) => {
  res.render('site/dashboard')
})


//--- Create availability ---
//---------------------------
router.get('/site/:id/create-availability', (req, res) => {
  res.render('site/create-availability/create-availability')
})

router.get('/site/:id/create-availability/type-of-session', (req, res) => {
  res.render('site/create-availability/type-of-session')
})

router.all('/site/:id/create-availability/dates', (req, res) => {
  res.render('site/create-availability/dates')
})

router.all('/site/:id/create-availability/days', (req, res) => {
  res.render('site/create-availability/days')
})

router.all('/site/:id/create-availability/time-and-capacity', (req, res) => {
  res.render('site/create-availability/time-and-capacity')
})

router.all('/site/:id/create-availability/services', (req, res) => {
  res.render('site/create-availability/services')
})

router.all('/site/:id/create-availability/check-answers', (req, res) => {
  res.render('site/create-availability/check-answers')
})

router.get('/site/:id/create-availability/process-new-session', (req, res) => {
  //process the `newSession` array to feed it into the sessions array
  const newSession = req.session.data.newSession

  if (!newSession) res.redirect(`/site/${req.site_id}/create-availability?new-session=false`)
  
  const newDailyAvailability = updateDailyAvailability(newSession, req.session.data.daily_availability, req.site_id)

  //replace daily availability into existing daily availability
  req.session.data.daily_availability = newDailyAvailability

  //clear the newSession data from the session
  delete req.session.data.newSession

  //redirect to the dashboard (or wherever you want)
  res.redirect(`/site/${req.site_id}/create-availability?new-session=true`)
})

//--- View availability ---
//-------------------------

// Helper so we never crash if session data is missing
function getAvailabilityAndBookings(req) {
  const data = (req.session && req.session.data) || {};
  const availability = data.availability;
  const bookings = data.bookings;
  return { availability, bookings };
}

router.get('/site/:id/view-availability', (req, res) => {

  const currentMonth = Number(req.query.month) || (new Date()).getMonth() + 1;
  const currentYear = Number(req.query.year) || (new Date()).getFullYear();
  const { availability, bookings } = getAvailabilityAndBookings(req);
  const siteId = req.site_id != null ? Number(req.site_id) : null;

  const monthModel = monthView({ availability, bookings }, currentYear, currentMonth, { siteId });

  // Attach stats per calendar-row week
  const weeksWithStats = monthModel.weeks.map((w) => {
    const weekStart = w.days[0].date.startOf("week");
    const weekEnd   = w.days[6].date.endOf("day");
    const stats = weekStats({ availability, bookings }, weekStart, { siteId });
    return { ...w, weekStart, weekEnd, stats };
  });

  res.render('site/view-availability/month', {
    //provide current month or month from query string
    currentMonth: currentMonth,
    currentYear: currentYear,
    weeks: weeksInMonth(currentMonth, currentYear),
    monthModel: { ...monthModel, weeks: weeksWithStats }
  })
})

router.get('/site/:id/view-availability/week', (req, res) => {
  const date = req.query.date ? req.query.date : DateTime.now().toFormat("yyyy-MM-dd");
  const daily_availability = req.session.data.daily_availability;
  const bookings = req.session.data.bookings;
  const siteId = req.site_id != null ? Number(req.site_id) : null;

  const weekDays = daysInWeek(date);
  for(let i=0; i<weekDays.length; i++) {
    const single_day_availability = daily_availability[DateTime.fromISO(weekDays[i]).toFormat("yyyy-MM-dd")]
    weekDays[i] = {
      date: weekDays[i],
      sessions: slotsForDay(single_day_availability, bookings, siteId, 'service')
    }
  }

  res.render('site/view-availability/week', {
    monday: weekDays[0].date,
    sunday: weekDays[6].date,
    weekDays
  })
})

router.get('/site/:id/view-availability/day', (req, res) => {
  //get datetime `yyyy-mm-dd` from url or today
  const date = req.query.date ? req.query.date : DateTime.now().toFormat("yyyy-MM-dd");
  const site_id = req.site_id != null ? Number(req.site_id) : null;
  const daily_availability = req.session.data.daily_availability;
  const bookings = req.session.data.bookings;

  const single_day_availability = daily_availability[date]

  res.render('site/view-availability/day', {
    date: date,
    sessions: slotsForDay(single_day_availability, bookings, site_id),
    isToday: DateTime.now().toFormat("yyyy-MM-dd") === date
  });
});


//end
module.exports = router

