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
  res.render('site/create-availability')
})

//end
module.exports = router
