// Journey: clinics (the per-site clinic list with pagination)
// URL: /site/:id/clinics
// Per-site context (res.locals.sessionHistory) is provided centrally by
// _shared/site-context.js.

const express = require('express');
const router = express.Router();
const {
  clearEditState,
  ensureCreateSession,
  toPositiveInteger,
  paginateItems,
  buildNhsPagination,
} = require('../_shared/helpers');

router.get('/site/:id/clinics', (req, res) => {
  clearEditState(req.session.data);
  ensureCreateSession(req.session.data);

  const clinicsPerPage = toPositiveInteger(req.features?.clinicsPerPage, 10);
  const requestedPage = toPositiveInteger(req.query.page, 1);
  const paginationResult = paginateItems(res.locals.sessionHistory || [], requestedPage, clinicsPerPage);
  const paginationQuery = { ...req.query };
  delete paginationQuery.page;

  res.locals.sessionHistory = paginationResult.items;

  const clinicsPagination = buildNhsPagination(
    `/site/${req.site_id}/clinics`,
    paginationQuery,
    paginationResult.currentPage,
    paginationResult.totalPages
  );

  res.render('clinics/clinics', {
    clinicsPagination
  });
});

module.exports = router;
