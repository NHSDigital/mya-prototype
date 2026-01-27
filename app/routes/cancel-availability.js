const express = require('express');
const router = express.Router();
const { DateTime } = require("luxon");

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

  const startDate = DateTime.local(startYear, startMonth, startDay);
  const endDate = DateTime.local(endYear, endMonth, endDay);

  console.log('Parsed startDate:', startDate.toISODate(), 'endDate:', endDate.toISODate());
  return { startDate, endDate };

  
}

// -----------------------------------------------------------------------------
// Cancel availability for a date range
// -----------------------------------------------------------------------------
router.get('/site/:id/cancel-availability', (req, res) => {
  res.render(`site/cancel-availability/dates`);
});


router.all('/site/:id/cancel-availability/sessions-and-bookings', (req, res) => {
  const { startDate, endDate } = getStartAndEndDates(req.session.data);

  res.render(`site/cancel-availability/sessions-and-bookings`, { 
    startDate, 
    endDate,
    ...req.query //pass through any query params for testing
  });
});

router.all('/site/:id/cancel-availability/check-answers', (req, res) => {
  const { startDate, endDate } = getStartAndEndDates(req.session.data);

  res.render(`site/cancel-availability/check-answers`, { startDate, endDate });
});

router.all('/site/:id/cancel-availability/success', (req, res) => {
  const { startDate, endDate } = getStartAndEndDates(req.session.data);

  res.render(`site/cancel-availability/success`, { startDate, endDate });
});

// -----------------------------------------------------------------------------
// EXPORT ROUTER
// -----------------------------------------------------------------------------
module.exports = router;