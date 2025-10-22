const express = require('express');
const router = express.Router();

//simple process-features route that redirects back to referrer
//this doesn't need any more - setting is handled in the flags middleware
router.get('/features', (req, res) => {
  const referer = req.get('Referer') || '/';
  res.render('features', {
    next: referer,
    features: req.features
  });
});

router.post('/process-features', (req, res) => {
  const referer = req.body.next || '/';
  res.redirect(referer);
});

module.exports = router;