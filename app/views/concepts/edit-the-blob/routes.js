const express = require('express');
const router = express.Router();

//set global locals and session data for all routes in this file
router.use('/concepts/edit-the-blob', (req, res, next) => {
  res.locals.siteLevel = {
    isOverview: false,
    isSite: true,
  };
  req.session.data.user.links.site = [
    {
      text: 'Kariison Health Centre',
    },
    {
      text: 'user@example.com',
      href: '#',
      hasIcon: true
    },
    {
      text: 'Log out',
      href: '#'
    }
  ]
  next();
});

//route for edit-the-blob starting point
router.get('/concepts/edit-the-blob', (req, res) => {
  res.render('concepts/edit-the-blob/all-availability');
});

router.get('/concepts/edit-the-blob/edit', (req, res) => {
  res.render('concepts/edit-the-blob/edit-availability', {
    calendar: require('./calendars-data.js'),
    availability: require('./availability-data.js')
  });
});


module.exports = router;