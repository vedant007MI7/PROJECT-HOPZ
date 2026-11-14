const router = require('express').Router();
const healthBusiness = require('../business/health.business');
const { ok, fail } = require('../function/response');

router.get('/', (req, res) => {
  if (req.app.locals.draining) return res.status(503).json(fail('Shutting down'));
  return res.json(ok({ status: 'ok' }));
});

router.get('/db', async (req, res) => res.json(ok(await healthBusiness.checkDb())));

module.exports = router;
