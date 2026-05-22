const express = require('express');

const router = express.Router();

router.get('/design-system-addons', (req, res) => {
  return res.render('design-system-addons/index', {
    pageName: 'Design system addons',
    docsSection: 'components',
    docsPage: 'home'
  });
});

router.get('/design-system-addons/app-card', (req, res) => {
  return res.render('design-system-addons/app-card', {
    pageName: 'App card',
    docsSection: 'components',
    docsPage: 'app-card'
  });
});

module.exports = router;
