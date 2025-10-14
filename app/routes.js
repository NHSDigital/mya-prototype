// External dependencies
const express = require('express')

const router = express.Router()
const { flagsMiddleware } = require('./flags/flags-library')
const { siteLevelMiddleware } = require('./middleware/site-level')

router.use(flagsMiddleware())
router.use(siteLevelMiddleware())

//urls

//set global param for site_id
router.param('id', (req, res, next, id) => {
  req.site_id = id;          // available in routes
  res.locals.site_id = id;   // available in all views
  next();
}); 

router.get('/site/:id', (req, res) => {
  res.render('site/dashboard')
})

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

//end
module.exports = router
