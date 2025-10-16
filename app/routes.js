// External dependencies
const express = require('express')

const router = express.Router()
const { flagsMiddleware } = require('./flags/flags-library')
const { siteLevelMiddleware } = require('./middleware/site-level')
const weeksInMonth = require("./helpers/weeksInMonth")
const { monthView, weekView, weekStats } = require("./helpers/availabilityViews")
const { getSlotsForDate } = require("./helpers/slots")

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

router.post('/site/:id/create-availability/process-new-session', (req, res) => {
  //process the `newSession` array to feed it into the sessions array
  const newSession = req.session.data.newSession

  if (!newSession) res.redirect(`/site/${req.site_id}/create-availability?new-session=false`)
  
  //normalise values to match them with the existing sessions array
  newSession.capacity = Number(newSession.capacity || 0)
  newSession.duration = Number(newSession.duration) || 0
  newSession.startTime = `${newSession.startTime.hour}:${newSession.startTime.minute}` || "00:00"
  newSession.endTime = `${newSession.endTime.hour}:${newSession.endTime.minute}` || "00:00"
  if (!Array.isArray(newSession.services)) {
    newSession.services = [newSession.services]
  }

  if(newSession.startDate) {
    //add prefix zeros to month and day if needed
    if(newSession.startDate.month < 10) newSession.startDate.month = '0' + newSession.startDate.month
    if(newSession.startDate.day < 10) newSession.startDate.day = '0' + newSession.startDate.day
    newSession.startDate = `${newSession.startDate.year}-${newSession.startDate.month}-${newSession.startDate.day}`
  }
  if(newSession.endDate) {
    //add prefix zeros to month and day if needed
    if(newSession.endDate.month < 10) newSession.endDate.month = '0' + newSession.endDate.month
    if(newSession.endDate.day < 10) newSession.endDate.day = '0' + newSession.endDate.day
    newSession.endDate = `${newSession.endDate.year}-${newSession.endDate.month}-${newSession.endDate.day}`
  }
  if(newSession.singleDate) {
    //add prefix zeros to month and day if needed
    if(newSession.singleDate.month < 10) newSession.singleDate.month = '0' + newSession.singleDate.month
    if(newSession.singleDate.day < 10) newSession.singleDate.day = '0' + newSession.singleDate.day
    newSession.singleDate = `${newSession.singleDate.year}-${newSession.singleDate.month}-${newSession.singleDate.day}`
  }

  newSession.site_id = Number(req.site_id)

  //get existing sessions array from data (or create a new one if it doesn't exist)
  const sessions = req.session.data.availability || []

  //add the new session to the sessions array
  sessions.push(newSession)

  //write the updated sessions array back to the session data
  req.session.data.availability = sessions

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
  console.log('availability', availability);
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

router.get('/site/:id/view-availability/day', (req, res) => {
  const date = req.query.date ? Date.parse(req.query.date) : Date.now();
  const { availability, bookings } = getAvailabilityAndBookings(req);
  const siteId = req.site_id != null ? Number(req.site_id) : null;

  const slots = getSlotsForDate(availability, bookings, date, siteId);

  res.render('site/view-availability/day', {
    date: date,
    allAppointments: slots
  });
});

router.get('/site/:id/view-availability/week', (req, res) => {
  const dateInAnyWeek = req.query.date ? Date.parse(req.query.date) : Date.now();
  const { availability, bookings } = getAvailabilityAndBookings(req);
  const siteId = req.site_id != null ? Number(req.site_id) : null;

  const weekModel = weekView({ availability, bookings }, dateInAnyWeek, { siteId });
  const stats = weekStats({ availability, bookings }, weekModel.weekStart, { siteId, includeOrphans: true });

  res.render('site/view-availability/week', {
    weekModel,
    stats
  })
});


//end
module.exports = router

